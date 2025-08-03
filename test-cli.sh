#!/bin/bash

# Make the script executable
echo "Making sure the bin script is executable..."
chmod +x bin/doofydev

# Create a temporary directory outside the project
echo "Creating a temporary directory for testing..."
TEMP_DIR=$(mktemp -d)

# Create a test file in the temporary directory
echo "Creating a test file in the temporary directory..."
echo "This is a test file" > "$TEMP_DIR/test.txt"

# Change to the temporary directory
cd "$TEMP_DIR"
echo "Current directory: $(pwd)"
echo "Files in current directory:"
ls -la

# Test running the CLI from the temporary directory
echo "Testing the CLI from outside the project directory..."
echo "This should use the current working directory ($TEMP_DIR):"
/Users/nhusby/projects/fraimwork/bin/doofydev

# Clean up
echo "Test complete. Cleaning up..."
cd -
rm -rf "$TEMP_DIR"