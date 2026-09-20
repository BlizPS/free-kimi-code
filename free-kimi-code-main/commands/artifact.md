---
description: Create a standalone deliverable in LazyDev's canonical artifact directory.
---
Create the requested standalone deliverable under `LAZYDEV_ARTIFACT_DIR`. On Termux/PRoot Debian/Ubuntu this is `/storage/emulated/0/lazydevfile`; on Windows/Linux/macOS it is the user's home-level `lazydevfile` directory. Native CLI application data is kept in the normal user-home locations for each CLI. The current platform path is injected by LazyDev at runtime. Verify the final file exists there before reporting the path. $ARGUMENTS
