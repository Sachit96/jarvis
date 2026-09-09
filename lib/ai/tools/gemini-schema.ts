import "server-only";
import { z } from "zod";

/**
 * Converts a Zod schema into the function-declaration shape Gemini accepts
 * (an OpenAPI subset: OBJECT/STRING/NUMBER/INTEGER/BOOLEAN/ARRAY, plus
 * properties/required/enum/items/description).
 *
 * Why convert rather than hand-write both: LOG_NUTRITION_TOOL's own comment
 * warns that writing a shape out twice lets the declaration drift from the
 * columns it actually feeds. Deriving the declaration from the same schema
 * that validates the arguments makes that drift impossible.
 *
 * Deliberately throws on anything it does not understand instead of emitting
 * a lenient `{ type: "STRING" }` fallback. An unsupported type would produce
 * a declaration that quietly misdescribes the tool to the model, and the
 * failure would surface as inexplicably bad tool calls at runtime. The
 * registry converts every tool at module load, so an unsupported schema
 * fails fast, at startup, with the tool's name attached.
 */

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  /**
   * Omitted entirely for a tool that takes no arguments.
   *
   * Gemini's FunctionDeclaration treats `parameters` as optional, and its
   * schema validation requires an OBJECT to carry a non-empty `properties`.
   * The two together mean a zero-argument tool must send no `parameters` at
   * all — `{type:"OBJECT", properties:{}, required:[]}` is rejected, and 13
   * of this app's tools take no arguments.
   */
  parameters?: GeminiSchema;
}

interface GeminiSchema {
  // Gemini's schema dialect is an open JSON object, and the declaration is
  // handed to callGemini as a Record<string, unknown>. The index signature
  // states that openness rather than forcing a cast at the boundary.
  [key: string]: unknown;
  type: string;
  description?: string;
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  enum?: string[];
}

/**
 * Peels the wrappers that carry no shape information of their own, so
 * `.optional()`, `.nullable()`, `.default()` and `.describe()` can be used
 * freely in tool schemas. Optionality is handled by the caller (it decides
 * the `required` list), not here.
 */
function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema;
  // Bounded rather than `while (true)`: a pathological chain of wrappers
  // would otherwise hang module load rather than throwing.
  for (let depth = 0; depth < 10; depth++) {
    const def = current.def as { type?: string; innerType?: z.ZodType };
    if (
      (def.type === "optional" || def.type === "nullable" || def.type === "default") &&
      def.innerType
    ) {
      current = def.innerType;
      continue;
    }
    return current;
  }
  throw new Error("Schema nests optional/nullable/default more than 10 deep");
}

function isOptional(schema: z.ZodType): boolean {
  const def = schema.def as { type?: string };
  return def.type === "optional" || def.type === "default";
}

function convert(schema: z.ZodType, path: string): GeminiSchema {
  const inner = unwrap(schema);
  const def = inner.def as {
    type?: string;
    entries?: Record<string, string>;
    element?: z.ZodType;
    shape?: Record<string, z.ZodType>;
  };
  // `.describe()` metadata lives on the outer wrapper, so read it before unwrapping.
  const description = (schema.meta()?.description ?? inner.meta()?.description) as string | undefined;
  const withDescription = (s: GeminiSchema): GeminiSchema =>
    description ? { ...s, description } : s;

  switch (def.type) {
    case "string":
      return withDescription({ type: "STRING" });
    case "number":
      return withDescription({ type: "NUMBER" });
    case "int":
      return withDescription({ type: "INTEGER" });
    case "boolean":
      return withDescription({ type: "BOOLEAN" });
    case "enum":
      return withDescription({ type: "STRING", enum: Object.values(def.entries ?? {}) });
    case "array": {
      if (!def.element) throw new Error(`Array at ${path} has no element type`);
      return withDescription({ type: "ARRAY", items: convert(def.element, `${path}[]`) });
    }
    case "object": {
      const shape = def.shape ?? {};
      // A nested object with no fields has no valid representation: unlike a
      // top-level one it cannot be omitted, and an empty `properties` is
      // rejected. Consistent with the rest of this converter, that fails at
      // module load with the path attached rather than at request time.
      if (Object.keys(shape).length === 0 && path.includes(".")) {
        throw new Error(
          `Empty object at ${path}. A nested object must declare at least one field — ` +
            `Gemini rejects an OBJECT schema with no properties.`,
        );
      }
      const properties: Record<string, GeminiSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value, `${path}.${key}`);
        if (!isOptional(value)) required.push(key);
      }
      // `required: []` is not wrong, but it is not what the API's own SDKs
      // emit, and an empty list carries no information. Omitting it keeps the
      // payload to exactly what the contract describes.
      return withDescription(
        required.length > 0 ? { type: "OBJECT", properties, required } : { type: "OBJECT", properties },
      );
    }
    default:
      throw new Error(
        `Unsupported Zod type "${def.type}" at ${path}. Tool schemas may use ` +
          `object, string, number, int, boolean, enum, array, and the ` +
          `optional/nullable/default/describe wrappers.`,
      );
  }
}

export function toGeminiDeclaration(
  name: string,
  description: string,
  schema: z.ZodType,
): GeminiFunctionDeclaration {
  const parameters = convert(schema, name);
  if (parameters.type !== "OBJECT") {
    throw new Error(`Tool "${name}" must take an object, got ${parameters.type}`);
  }

  // A zero-argument tool sends NO parameters field. Emitting
  // `{type:"OBJECT", properties:{}}` instead is the one shape Gemini's schema
  // validation rejects outright, and z.object({}) — which is how a tool
  // declares "no arguments" — converts to exactly that. Handled here, in the
  // one converter every tool goes through, rather than in 13 tool files.
  if (Object.keys(parameters.properties ?? {}).length === 0) {
    return { name, description };
  }

  return { name, description, parameters };
}
