import { DatabaseProvider, DatabaseProviderInfo } from './types';

export const DATABASE_PROVIDERS: DatabaseProviderInfo[] = [
  {
    id: 'sqlite',
    name: 'SQLite',
    description: 'Local file-based database, perfect for prototyping',
    type: 'sqlite',
    requiresConnectionString: false,
    fields: [
      {
        key: 'database',
        label: 'Database Name',
        type: 'text',
        required: true,
        placeholder: 'my-schema',
        description: 'Name for your SQLite database (stored in browser)'
      }
    ],
    icon: 'harddrive',
    website: 'https://sqlite.org',
    freeOption: true
  },
  {
    id: 'postgres-local',
    name: 'PostgreSQL Local',
    description: 'Local PostgreSQL server for development',
    type: 'postgres',
    requiresConnectionString: false,
    fields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        required: true,
        placeholder: 'localhost',
        description: 'Database host (usually localhost)'
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '5432',
        description: 'PostgreSQL port (default: 5432)'
      },
      {
        key: 'database',
        label: 'Database Name',
        type: 'text',
        required: true,
        placeholder: 'my_database',
        description: 'Name of your PostgreSQL database'
      },
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        required: true,
        placeholder: 'postgres',
        description: 'PostgreSQL username'
      },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: false,
        placeholder: 'your-password',
        description: 'PostgreSQL password (leave empty if none)'
      }
    ],
    icon: 'server',
    website: 'https://postgresql.org',
    freeOption: true
  },
  {
    id: 'mysql-local',
    name: 'MySQL/MariaDB Local',
    description: 'Local MySQL or MariaDB server for development',
    type: 'mysql',
    requiresConnectionString: false,
    fields: [
      {
        key: 'host',
        label: 'Host',
        type: 'text',
        required: true,
        placeholder: 'localhost',
        description: 'Database host (usually localhost)'
      },
      {
        key: 'port',
        label: 'Port',
        type: 'number',
        required: true,
        placeholder: '3306',
        description: 'MySQL/MariaDB port (default: 3306)'
      },
      {
        key: 'database',
        label: 'Database Name',
        type: 'text',
        required: true,
        placeholder: 'my_database',
        description: 'Name of your MySQL/MariaDB database'
      },
      {
        key: 'username',
        label: 'Username',
        type: 'text',
        required: true,
        placeholder: 'root',
        description: 'MySQL/MariaDB username'
      },
      {
        key: 'password',
        label: 'Password',
        type: 'password',
        required: false,
        placeholder: 'your-password',
        description: 'MySQL/MariaDB password (leave empty if none)'
      }
    ],
    icon: 'database',
    website: 'https://mysql.com',
    freeOption: true
  }
];

export function getProviderInfo(providerId: DatabaseProvider): DatabaseProviderInfo | undefined {
  return DATABASE_PROVIDERS.find(p => p.id === providerId);
}

export function getProvidersByType(type: 'postgres' | 'mysql' | 'sqlite'): DatabaseProviderInfo[] {
  return DATABASE_PROVIDERS.filter(p => p.type === type);
}

export function getFreeProviders(): DatabaseProviderInfo[] {
  return DATABASE_PROVIDERS.filter(p => p.freeOption);
}