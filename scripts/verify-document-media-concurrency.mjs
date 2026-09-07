import assert from "node:assert/strict";
const base = "http://127.0.0.1:3211";
for (let iteration = 0; iteration < 8; iteration++) {
  const upload = new FormData(); upload.set("file", new File([`Original ${iteration}`], "concurrency.txt", { type: "text/plain" }));
  const uploaded = await fetch(`${base}/api/attachments`, { method: "POST", body: upload });
  assert(uploaded.ok); const { attachment } = await uploaded.json();
  const block = { id: `race-${iteration}`, type: "media", mediaType: "file", attachmentId: attachment.id, url: "", filename: "concurrency.txt" };
  const entry = new FormData(); entry.set("title", "Concurrent attachment acceptance");
  entry.set("contentMarkdown", `[concurrency.txt](attachment:${attachment.id}) <!--labnest-media:${encodeURIComponent(JSON.stringify(block))}-->`);
  const [saved, deleted] = await Promise.all([
    fetch(`${base}/api/entries`, { method: "POST", body: entry }),
    fetch(`${base}/api/attachments/${attachment.id}`, { method: "DELETE" }),
  ]);
  assert(!(saved.ok && deleted.ok), "A saved body and physical deletion cannot both succeed");
  if (saved.ok) {
    assert.equal(deleted.status, 409);
    assert.equal((await fetch(`${base}/api/attachments/${attachment.id}`)).status, 200);
  } else {
    assert(deleted.ok); assert.equal(saved.status, 400);
  }
}
console.log("PASS 8 concurrent record-save/original-delete attempts preserve consistency");
