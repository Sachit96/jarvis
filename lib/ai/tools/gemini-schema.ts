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
  parameters: GeminiSchema;
}

interface GeminiSchema {
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
      const properties: Record<string, GeminiSchema> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value, `${path}.${key}`);
        if (!isOptional(value)) required.push(key);
      }
      return withDescription({ type: "OBJECT", properties, required });
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
  return { name, description, parameters };
}
