# DoofyDev CLI

This document explains how to install and use the DoofyDev CLI from any directory.

## Installation

### Local Development

If you're working on the DoofyDev project, you can make the CLI available globally on your system by using npm's link feature:

```bash
# From the project root directory
npm link
```

This will create a symbolic link in your global npm bin directory, making the `doofydev` command available from anywhere.

### Global Installation

To install the CLI globally:

```bash
# Install directly from the repository
npm install -g /path/to/doofydev

# Or if published to npm
npm install -g doofydev
```

## Usage

Once installed, you can run the CLI from any directory:

```bash
doofydev
```

This will start the interactive CLI interface.

## Available Commands

The CLI supports various commands:

- `/help` - Show help message
- `/clear` - Clear conversation history
- `/exit` - Exit the CLI

For more details on available tools and commands, run the CLI and type `/help`.

## Uninstalling

To remove the global link:

```bash
npm unlink doofydev
```

Or if installed globally:

```bash
npm uninstall -g doofydev
```