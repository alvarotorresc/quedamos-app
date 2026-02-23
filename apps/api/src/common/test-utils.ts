/* Shared test utilities and mock factories for backend tests */

export function createMockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    group: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    groupMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    availability: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventAttendee: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    pushToken: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };
}

export function createMockNotificationsService() {
  return {
    sendToUser: jest.fn().mockResolvedValue({ sent: 1 }),
    sendToGroup: jest.fn().mockResolvedValue({ sent: 1 }),
    isNotificationEnabled: jest.fn().mockResolvedValue(true),
    registerToken: jest.fn(),
    unregisterToken: jest.fn(),
    getPreferences: jest.fn(),
    updatePreference: jest.fn(),
    onModuleInit: jest.fn(),
  };
}

export function createMockConfigService(overrides: Record<string, string> = {}) {
  const config: Record<string, string> = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_JWT_SECRET: 'test-secret',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: Buffer.from('test-key').toString('base64'),
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => config[key]),
    getOrThrow: jest.fn((key: string) => {
      if (!config[key]) throw new Error(`Missing ${key}`);
      return config[key];
    }),
  };
}

// Factory functions for test data
export function createTestUser(overrides: Partial<{
  id: string; email: string; name: string; avatarEmoji: string;
  createdAt: Date; updatedAt: Date;
}> = {}) {
  return {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    avatarEmoji: '😊',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function createTestGroup(overrides: Partial<{
  id: string; name: string; emoji: string; inviteCode: string;
  createdById: string; createdAt: Date; updatedAt: Date;
}> = {}) {
  return {
    id: 'group-1',
    name: 'Test Group',
    emoji: '👥',
    inviteCode: '12345678',
    createdById: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

export function createTestEvent(overrides: Partial<{
  id: string; groupId: string; title: string; description: string;
  location: string; date: Date; time: string; status: string;
  createdById: string; createdAt: Date; updatedAt: Date;
}> = {}) {
  return {
    id: 'event-1',
    groupId: 'group-1',
    title: 'Test Event',
    description: null,
    location: null,
    date: new Date('2026-03-01'),
    time: '18:00',
    status: 'pending',
    createdById: 'user-1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}
