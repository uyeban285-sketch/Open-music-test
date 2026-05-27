/**
 * Dev seed script: creates two users (admin + listener),
 * feature flags, and connector fixtures.
 *
 * Usage: pnpm db:seed:dev
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await argon2.hash('admin_password_123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@openmusic.dev' },
    update: {},
    create: {
      email: 'admin@openmusic.dev',
      passwordHash: adminPassword,
      role: 'admin',
      mfaEnabled: false,
    },
  });

  // Create listener user
  const listenerPassword = await argon2.hash('listener_password_123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });

  const listener = await prisma.user.upsert({
    where: { email: 'listener@openmusic.dev' },
    update: {},
    create: {
      email: 'listener@openmusic.dev',
      passwordHash: listenerPassword,
      role: 'listener',
      mfaEnabled: false,
    },
  });

  // Create feature flags
  await prisma.featureFlag.upsert({
    where: { key: 'local_ai_enabled' },
    update: {},
    create: {
      key: 'local_ai_enabled',
      description: 'Enable Local AI module for power users',
      enabled: false,
      rolloutPercentage: 0,
    },
  });

  await prisma.featureFlag.upsert({
    where: { key: 'semantic_search_enabled' },
    update: {},
    create: {
      key: 'semantic_search_enabled',
      description: 'Enable semantic search with vector embeddings',
      enabled: true,
      rolloutPercentage: 100,
    },
  });

  await prisma.featureFlag.upsert({
    where: { key: 'discovery_mode_enabled' },
    update: {},
    create: {
      key: 'discovery_mode_enabled',
      description: 'Enable Discovery Mode for enthusiasts',
      enabled: true,
      rolloutPercentage: 100,
    },
  });

  console.log('Seed complete:', { admin: admin.id, listener: listener.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
