/** Form openings carry their own version; server read-after-submit is not a substitute. */
export function assertDocumentSaveVersion(form: FormData, current: {updatedAt:Date}) {
 const expected = form.get("expectedUpdatedAt");
 if (expected && new Date(String(expected)).getTime() !== current.updatedAt.getTime()) throw new Error("另一窗口已修改此文档。当前输入保留，请核对最新版本后再保存。");
}
