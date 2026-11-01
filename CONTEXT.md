# LabNest domain

AI service: a named connection whose protocol, destination, credential and model identify the external service. Saved configuration: the workspace's persisted settings, distinct from an unsaved form draft. Connection test: an explicit, temporary observation that a fixed non-business message produced valid output; configuration completeness and model-list reachability alone do not establish it. Requested model and returned model are separate facts. Dify selects its model inside the application.

Protocol: reusable versioned authored laboratory instructions. ProtocolVersion: immutable adopted source after review; edits produce a linked revision. Experiment: a concrete execution with a captured source snapshot. Run: the execution view and observations for that Experiment. Explicit step: an author-confirmed operation with a stable identity; headings and ordinary checkboxes are not sufficient. Selection dimension: an independent choice such as reaction volume or sample property. Preset: named combination of choices, requiring human confirmation. Applicability: applicable, not applicable, or unknown. Required skip: explained omission that remains distinct from completion and remains in the required denominator.

`ExperimentStep.groupKey` is a source Protocol grouping, not an assay/treatment group. P1 execution scope is one Experiment. Canonical contracts and staged requirements: docs/modules/structured-protocol/20261014/CONTRACT.md.

## Language: devices and offline work

**LabNest instance（LabNest 实例）**:
One identifiable installation serving research workspaces, distinct from the network address used to reach it.
_Avoid_: IP address as the identity of LabNest

**LabNest workspace（工作区）**:
A collection of related research records and resources available to its authorized participants. A workspace is not a single Experiment or a particular device.
_Avoid_: Experiment as the scope of device pairing

**Paired LabNest device（已配对设备）**:
An App installation registered under an authenticated person and authorized workspace access. Registration is distinct from present network availability and is not itself a person identity or a grant to every record.
_Avoid_: Online, signed-in user

**Active experiment（当前实验）**:
The Experiment currently selected for viewing or execution on a device. Selecting another Experiment does not create a new device identity.
_Avoid_: Pairing target

**Locally saved research change（本地已保存修改）**:
A research change retained on the originating device but not yet acknowledged by the workspace server. It is not yet a server-confirmed shared record.
_Avoid_: Synced, saved on the computer

**Watch companion（手表辅助端）**:
The research-task view and controls used alongside the researcher's accompanying iPhone. Business operations are durably handed to that phone by default, with phone-saved and server-confirmed receipts kept distinct. Cellular service or direct Mac access is not required; this is not a separate full laboratory-management workspace.
_Avoid_: Independent full-featured Watch client

**Legacy account-free workspace（旧无账号工作区）**:
Research data created before person accounts were introduced. It may contain real research records and pending device changes; migration preserves their original provenance rather than attributing all earlier actions to a new owner. This is a historical state, not a separate new trial product.
_Avoid_: Public demo, shared demo account, retrospectively verified authorship

**Account-linked workspace（账号关联工作区）**:
A LabNest workspace that a person account is authorized to access through a membership relationship. Linking an account does not create a second copy of the workspace or establish authorship of its earlier device-only records.
_Avoid_: User account as the workspace itself

**Cross-network access（跨网络访问）**:
A trusted route to the same LabNest instance when the phone and computer use different networks, including mutually isolated Wi-Fi networks with internet access. A shared Wi-Fi name, an account login or automatic LAN address discovery alone does not provide this route.
_Avoid_: Same-Wi-Fi requirement, login as proof of reachability

**Offline authorized work（离线授权工作）**:
Continued work on prepared local content under the previously established person and workspace context when the server is temporarily unreachable. Reconnection rechecks current permission and record versions before accepting changes; offline storage does not guarantee immediate cross-device consistency.
_Avoid_: Anonymous fallback, changing the author to bypass revoked access
