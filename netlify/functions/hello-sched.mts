console.log("HELLO-SCHED module loaded");

export default async () => {
  console.log("HELLO-SCHED handler ran");
  return new Response("ok");
};

export const config = { schedule: "@hourly" };
