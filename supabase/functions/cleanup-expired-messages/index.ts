import { createClient } from "npm:@supabase/supabase-js@2";

const RETENTION_HOURS = 24;
const BATCH_SIZE = 1000;
const MAX_BATCHES_PER_RUN = 10;
const BUCKET = "chat-media";
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;

function getChatImagePath(imageUrl: string | null): string | null {
  if (!imageUrl) return null;

  try {
    const pathname = new URL(imageUrl).pathname;
    const markerIndex = pathname.indexOf(PUBLIC_URL_MARKER);
    if (markerIndex === -1) return null;

    const path = decodeURIComponent(pathname.slice(markerIndex + PUBLIC_URL_MARKER.length));
    return path.startsWith("images/") ? path : null;
  } catch {
    return null;
  }
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "Missing Supabase function secrets" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  let deletedMessages = 0;
  let deletedImages = 0;

  for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
    const { data: expiredMessages, error: selectError } = await supabase
      .from("messages")
      .select("id,image_url")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (selectError) return Response.json({ error: selectError.message }, { status: 500 });
    if (!expiredMessages?.length) break;

    const imagePaths = [...new Set(expiredMessages
      .map((message) => getChatImagePath(message.image_url))
      .filter((path): path is string => Boolean(path)))];

    if (imagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(BUCKET).remove(imagePaths);
      if (storageError) return Response.json({ error: storageError.message }, { status: 500 });
      deletedImages += imagePaths.length;
    }

    const ids = expiredMessages.map((message) => message.id);
    const { error: deleteError } = await supabase.from("messages").delete().in("id", ids);
    if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 });
    deletedMessages += ids.length;

    if (expiredMessages.length < BATCH_SIZE) break;
  }

  return Response.json({ cutoff, deletedMessages, deletedImages });
});
