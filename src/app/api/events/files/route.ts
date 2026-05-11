import { getFileWatcherHub } from "@/lib/file-watcher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const hub = getFileWatcherHub();

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const writeRaw = (s: string) => controller.enqueue(enc.encode(s));
      const sendData = (obj: object) => {
        writeRaw(`data: ${JSON.stringify(obj)}\n\n`);
      };

      const ping = setInterval(() => {
        writeRaw(": ping\n\n");
      }, 25000);

      sendData({ type: "connected" });
      const off = hub.subscribe(() => {
        sendData({ type: "files_changed" });
      });

      const cleanup = () => {
        clearInterval(ping);
        off();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      req.signal.addEventListener("abort", cleanup, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
