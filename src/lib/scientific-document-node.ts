import { Node } from '@tiptap/core';

// Serialization stores named sections only, so editable blocks must stay inside them.
export const ScientificDocumentNode = Node.create({
  name: 'doc',
  topNode: true,
  content: 'scientificSection+',
});
