# Physical iPhone and Apple Watch installation — 2026-10-21

## Verified result

A signed LabNest iPhone companion and its Apple Watch app were installed and launched successfully on physical devices. The Watch was an Apple Watch Series 8 running watchOS 26.6. A separate process readback confirmed LabNestWatch running after launch.

This report records installation and launch. An actual experiment pairing and Watch-to-server transfer were not verified in this installation session. Physical timer accuracy and notification delivery remain unverified; no experimental action was performed.

## Diagnosis and repair

The earlier local Watch provisioning profile included the iPhone but omitted the Watch, causing an integrity verification failure. After reconnecting the Mac, iPhone and Watch on one hotspot, live device information confirmed Developer Mode enabled and the developer tunnel available; earlier disabled-mode information was cached.

The Watch scheme in `native/LabNestMobile/LabNestMobile.xcodeproj` was built for the actual Watch destination with automatic signing, provisioning updates and device registration enabled. Both the Watch product and the Watch app embedded in the iPhone product then authorized the device. Signed build and deep signature verification passed. Installation and launch succeeded for both products; the Watch process was subsequently read back. VPN settings were not changed during this attempt.

## Reproduce an installation

1. Open the iPhone companion project in Xcode and use the same personal development team for the phone and Watch targets. Keep signing accounts, certificates, profiles and device identifiers local.
2. Pair the physical Watch with the iPhone in the system Watch app. Connect, unlock and trust the devices, then confirm their live Developer Mode and tunnel status in Xcode.
3. Build for the actual connected device. If the Watch rejects integrity verification, check that the current profile includes that Watch rather than reusing a phone-only profile.
4. Install and launch the phone companion and Watch product. Check the Watch process independently; a successful build alone is not proof of installation or launch.
5. Use the computer's current reachable LAN address for port 3001. Generate a new four-digit code on the experiment's Other devices screen, preserving leading zeros. Complete phone confirmation and Watch-to-server pairing as a separate acceptance check.

This was a Personal Team development installation, not an App Store or TestFlight release. Development profiles expire; check each product's current profile and re-sign/reinstall when required. Device-specific expiry times remain in the local installation record.

## Four-digit code and server consistency

The iPhone numeric field, shared Swift link validation, Watch UI/model and server code were already published with four-digit pairing. Their authored sources match GitHub main `2f2c7583` and the 3001 application deployed from that revision. This documentation update does not change that implementation.

The Swift pairing checks pass normalization, leading-zero cases and 16 invalid link inputs. The installed product's successful build/install/launch outcomes were read back from the local installation evidence. These are separate from experiment pairing, timers, notification permissions and actual delivery.

## Evidence handling

The original local report, signed build products, build/signature logs, installation results, launch results and Watch process readback are retained locally. Raw device identifiers, credentials, provisioning profiles, personal Xcode state and current hotspot addresses are not published. Existing simulator/server acceptance is documented in [four-digit pairing verification](../watch-four-digit-20261020/verification.md).
