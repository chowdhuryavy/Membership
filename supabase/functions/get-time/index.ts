import { format } from "npm:date-fns";

Deno.serve(() => {
  const now = format(new Date(), "yyyy-MM-dd HH:mm:ss");
  return new Response(`Time: ${now}`);
});
