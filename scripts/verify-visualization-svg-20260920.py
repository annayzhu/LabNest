"""Compare formal SVG exports with their actual preview DOM; no pixel guessing."""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

base = Path('docs/visualization/20260920/evidence/after')
attributes = ['x', 'y', 'cx', 'cy', 'width', 'height', 'r', 'd', 'points',
              'fill', 'stroke', 'opacity', 'fill-opacity']

def marks(root):
    return [(node.tag, tuple((key, node.attrib.get(key)) for key in attributes), node.text)
            for node in root.iter()
            if node.tag.split('}')[-1] in ['rect', 'circle', 'path', 'line', 'polygon', 'text']]

report = []
for preview in sorted(base.glob('*.svg')):
    if preview.stem.endswith('-export'):
        continue
    exported = preview.with_stem(preview.stem + '-export')
    assert marks(ET.parse(preview).getroot()) == marks(ET.parse(exported).getroot()), preview.name
    report.append({'figure': preview.name, 'formalSvgGeometryColorsTextMatchPreview': True})
assert len(report) == 36
(base.parent / 'svg-export-parity.json').write_text(json.dumps(report, indent=2))
print(f'{len(report)} formal SVG geometry/color/text comparisons passed')
