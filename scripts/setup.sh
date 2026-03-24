#!/bin/bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ____             _       _ ____                "
echo " / ___|  ___   ___(_) __ _| |  _ \ _ __ ___  _ __  "
echo " \___ \ / _ \ / __| |/ _\` | | | | | '__/ _ \| '_ \ "
echo "  ___) | (_) | (__| | (_| | | |_| | | | (_) | |_) |"
echo " |____/ \___/ \___|_|\__,_|_|____/|_|  \___/| .__/ "
echo "                                             |_|    "
echo -e "${NC}"

# 1. Check Docker
echo -e "${YELLOW}[1/5] Checking Docker...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}✗ Docker is not running. Please start Docker and retry.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Docker is running${NC}"

# 2. Copy .env
echo -e "${YELLOW}[2/5] Configuring environment...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "${GREEN}✓ .env created from .env.example — please fill in your credentials${NC}"
  echo -e "${YELLOW}  Edit .env before continuing. Exiting...${NC}"
  exit 0
else
  echo -e "${GREEN}✓ .env already exists${NC}"
fi

# 3. Start infra services
echo -e "${YELLOW}[3/5] Starting PostgreSQL and Redis...${NC}"
docker compose up -d postgres redis
echo "Waiting for services to be healthy..."
sleep 5

# 4. Run migrations
echo -e "${YELLOW}[4/5] Running database migrations...${NC}"
export $(grep -v '^#' .env | xargs)
npx prisma migrate deploy --schema=libs/prisma/prisma/schema.prisma
echo -e "${GREEN}✓ Migrations applied${NC}"

# 5. Ask launch mode
echo ""
echo -e "${CYAN}How do you want to run SocialDrop?${NC}"
echo "  1) Development (nx serve — hot reload)"
echo "  2) Production  (docker compose — full stack)"
read -p "Choice [1/2]: " choice

case $choice in
  1)
    echo -e "${GREEN}Starting in development mode...${NC}"
    echo "API: http://localhost:3000/api"
    echo "Docs: http://localhost:3000/api/docs"
    echo "Web: http://localhost:4200"
    npx nx run-many -t serve -p api web --parallel
    ;;
  2)
    echo -e "${GREEN}Starting in production mode...${NC}"
    docker compose up -d api web
    echo -e "${GREEN}✓ SocialDrop is running!${NC}"
    echo "  Web: http://localhost:4200"
    echo "  API: http://localhost:3000/api"
    echo "  Docs: http://localhost:3000/api/docs"
    ;;
  *)
    echo -e "${YELLOW}No launch mode selected. Run manually with:${NC}"
    echo "  Dev:  npx nx serve api  &&  npx nx serve web"
    echo "  Prod: docker compose up -d"
    ;;
esac
