#!/usr/bin/env python3
"""Run the exact WatchModel.refresh method with isolated Swift test dependencies.

Use --baseline f4e97fd5 to reproduce the pre-change missing feedback.
The full watchOS build separately checks platform types and the SwiftUI view.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
baseline = sys.argv[sys.argv.index('--baseline') + 1] if '--baseline' in sys.argv else None
source = (subprocess.check_output(['git', 'show', baseline + ':native/LabNestWatch/WatchModel.swift'], cwd=root, text=True)
          if baseline else (root / 'native/LabNestWatch/WatchModel.swift').read_text())
types = source[source.index('struct MixLine:'):source.index('/// Secrets stay')]
method = source[source.index('    func refresh('):source.index('    func operate(')]
fixture = (root / 'native/LabNestMobileTests/WatchSyncChecks.swift').read_text()
with tempfile.TemporaryDirectory(prefix='labnest-watch-sync-checks-') as temporary:
    directory = Path(temporary)
    (directory / 'Checks.swift').write_text(fixture.replace('// MODEL_TYPES', types).replace('    // REFRESH_UNDER_TEST', method))
    subprocess.run(['xcrun', 'swiftc', '-parse-as-library', str(directory / 'Checks.swift'), '-o', str(directory / 'checks')], check=True)
    subprocess.run([str(directory / 'checks')], check=True)
