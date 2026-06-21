#!/bin/bash
# EC2 First-time Setup Script
# Run this once on your EC2 instance after launch.
#
# Usage:
#   ssh ubuntu@<ec2-ip> 'bash -s' < .github/deploy/ec2-setup.sh

set -euo pipefail

echo "=== Updating system packages ==="
sudo apt-get update -y
sudo apt-get upgrade -y

echo "=== Installing Docker ==="
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "=== Adding ubuntu user to docker group ==="
sudo usermod -aG docker ubuntu

echo "=== Installing AWS CLI v2 for ECR login ==="
sudo apt-get install -y unzip
curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip -q awscliv2.zip
sudo ./aws/install
rm -rf aws awscliv2.zip

echo "=== Creating app directory ==="
mkdir -p /home/ubuntu/soter
cd /home/ubuntu/soter

echo "=== Copying docker-compose files ==="
# These will be populated by the CI/CD pipeline

echo "=== Setting up swap (2GB) ==="
sudo fallocate -l 2G /swapfile || true
sudo chmod 600 /swapfile
sudo mkswap /swapfile || true
sudo swapon /swapfile || true
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

echo "=== Done! ==="
echo "Next steps:"
echo "  1. Configure GitHub Secrets (EC2_HOST, EC2_SSH_KEY, etc.)"
echo "  2. Push to main branch to trigger deploy"
echo "  3. Verify at http://$(curl -s http://checkip.amazonaws.com):3000"
