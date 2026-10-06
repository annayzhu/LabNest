import { createHash } from 'node:crypto';
type Version = {id: string; contentJson: unknown; reviewStage: string; displayVersion: string; protocol: {updatedAt: Date}};
/** ProtocolVersion has no updatedAt; include its document and the shared metadata version. */
export function protocolSaveVersion(version: Version) {
  return createHash('sha256').update(JSON.stringify({id:version.id,content:version.contentJson,stage:version.reviewStage,displayVersion:version.displayVersion,protocolUpdatedAt:version.protocol.updatedAt.toISOString()})).digest('hex');
}
