import { DatabaseProvider } from './types';

export interface DatabaseSyntaxConfig {
  autoIncrement: {
    integerType: string;
    syntax: string;
  };
  dataTypes: {
    serial: string;
    text: string;
    integer: string;
    boolean: string;
    timestamp: string;
    decimal: string;
    varchar: (length?: number) => string;
  };
  constraints: {
    primaryKey: string;
    notNull: string;
    unique: string;
    foreignKey: (referencedTable: string, referencedColumn: string) => string;
  };
  functions: {
    now: string;
    uuid: string;
  };
}

const DATABASE_SYNTAX: Record<string, DatabaseSyntaxConfig> = {
  postgresql: {
    autoIncrement: {
      integerType: 'INTEGER',
      syntax: 'SERIAL PRIMARY KEY'
    },
    dataTypes: {
      serial: 'SERIAL',
      text: 'TEXT',
      integer: 'INTEGER',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP',
      decimal: 'DECIMAL',
      varchar: (length = 255) => `VARCHAR(${length})`
    },
    constraints: {
      primaryKey: 'PRIMARY KEY',
      notNull: 'NOT NULL',
      unique: 'UNIQUE',
      foreignKey: (referencedTable, referencedColumn) => `REFERENCES ${referencedTable}(${referencedColumn})`
    },
    functions: {
      now: 'NOW()',
      uuid: 'gen_random_uuid()'
    }
  },

  mysql: {
    autoIncrement: {
      integerType: 'INT',
      syntax: 'INT AUTO_INCREMENT PRIMARY KEY'
    },
    dataTypes: {
      serial: 'INT AUTO_INCREMENT',
      text: 'TEXT',
      integer: 'INT',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP',
      decimal: 'DECIMAL',
      varchar: (length = 255) => `VARCHAR(${length})`
    },
    constraints: {
      primaryKey: 'PRIMARY KEY',
      notNull: 'NOT NULL',
      unique: 'UNIQUE',
      foreignKey: (referencedTable, referencedColumn) => `REFERENCES ${referencedTable}(${referencedColumn})`
    },
    functions: {
      now: 'NOW()',
      uuid: 'UUID()'
    }
  },

  sqlite: {
    autoIncrement: {
      integerType: 'INTEGER',
      syntax: 'INTEGER PRIMARY KEY AUTOINCREMENT'
    },
    dataTypes: {
      serial: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      text: 'TEXT',
      integer: 'INTEGER',
      boolean: 'INTEGER', // SQLite doesn't have native boolean
      timestamp: 'TEXT', // SQLite stores timestamps as text
      decimal: 'REAL',
      varchar: (length = 255) => 'TEXT' // SQLite treats VARCHAR as TEXT
    },
    constraints: {
      primaryKey: 'PRIMARY KEY',
      notNull: 'NOT NULL',
      unique: 'UNIQUE',
      foreignKey: (referencedTable, referencedColumn) => `REFERENCES ${referencedTable}(${referencedColumn})`
    },
    functions: {
      now: "datetime('now')",
      uuid: "lower(hex(randomblob(16)))" // SQLite UUID alternative
    }
  },

  supabase: {
    autoIncrement: {
      integerType: 'INTEGER',
      syntax: 'SERIAL PRIMARY KEY'
    },
    dataTypes: {
      serial: 'SERIAL',
      text: 'TEXT',
      integer: 'INTEGER',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP WITH TIME ZONE',
      decimal: 'DECIMAL',
      varchar: (length = 255) => `VARCHAR(${length})`
    },
    constraints: {
      primaryKey: 'PRIMARY KEY',
      notNull: 'NOT NULL',
      unique: 'UNIQUE',
      foreignKey: (referencedTable, referencedColumn) => `REFERENCES ${referencedTable}(${referencedColumn})`
    },
    functions: {
      now: 'NOW()',
      uuid: 'gen_random_uuid()'
    }
  },

  planetscale: {
    autoIncrement: {
      integerType: 'INT',
      syntax: 'INT AUTO_INCREMENT PRIMARY KEY'
    },
    dataTypes: {
      serial: 'INT AUTO_INCREMENT',
      text: 'TEXT',
      integer: 'INT',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP',
      decimal: 'DECIMAL',
      varchar: (length = 255) => `VARCHAR(${length})`
    },
    constraints: {
      primaryKey: 'PRIMARY KEY',
      notNull: 'NOT NULL',
      unique: 'UNIQUE',
      foreignKey: (referencedTable, referencedColumn) => `REFERENCES ${referencedTable}(${referencedColumn})`
    },
    functions: {
      now: 'NOW()',
      uuid: 'UUID()'
    }
  },

  // Add mappings for the actual provider values from types.ts
  'postgres-local': {
    autoIncrement: {
      integerType: 'INTEGER',
      syntax: 'SERIAL PRIMARY KEY'
    },
    dataTypes: {
      serial: 'SERIAL',
      text: 'TEXT',
      integer: 'INTEGER',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP',
      decimal: 'DECIMAL',
      varchar: (length = 255) => `VARCHAR(${length})`
    },
    constraints: {
      primaryKey: 'PRIMARY KEY',
      notNull: 'NOT NULL',
      unique: 'UNIQUE',
      foreignKey: (referencedTable, referencedColumn) => `REFERENCES ${referencedTable}(${referencedColumn})`
    },
    functions: {
      now: 'NOW()',
      uuid: 'gen_random_uuid()'
    }
  },

  'mysql-local': {
    autoIncrement: {
      integerType: 'INT',
      syntax: 'INT AUTO_INCREMENT PRIMARY KEY'
    },
    dataTypes: {
      serial: 'INT AUTO_INCREMENT',
      text: 'TEXT',
      integer: 'INT',
      boolean: 'BOOLEAN',
      timestamp: 'TIMESTAMP',
      decimal: 'DECIMAL',
      varchar: (length = 255) => `VARCHAR(${length})`
    },
    constraints: {
      primaryKey: 'PRIMARY KEY',
      notNull: 'NOT NULL',
      unique: 'UNIQUE',
      foreignKey: (referencedTable, referencedColumn) => `REFERENCES ${referencedTable}(${referencedColumn})`
    },
    functions: {
      now: 'NOW()',
      uuid: 'UUID()'
    }
  }
};

export class SQLSyntaxMapper {
  /**
   * Get database-specific syntax configuration
   */
  public static getSyntaxConfig(provider: DatabaseProvider): DatabaseSyntaxConfig {
    // Map provider types to syntax configs
    const providerKey = provider as string;
    const config = DATABASE_SYNTAX[providerKey];
    
    if (!config) {
      console.warn(`No syntax config found for provider: ${provider}, defaulting to postgresql`);
      return DATABASE_SYNTAX['postgresql'];
    }
    
    return config;
  }

  /**
   * Convert a data type to database-specific syntax
   */
  public static mapDataType(
    genericType: string, 
    provider: DatabaseProvider, 
    options?: { length?: number }
  ): string {
    const config = this.getSyntaxConfig(provider);
    const lowerType = genericType.toLowerCase();

    // Handle special cases
    if (lowerType === 'serial' || (lowerType === 'integer' && options?.length === -1)) {
      return config.dataTypes.serial;
    }

    if (lowerType.startsWith('varchar')) {
      const lengthMatch = lowerType.match(/varchar\((\d+)\)/);
      const length = lengthMatch ? parseInt(lengthMatch[1]) : options?.length;
      return config.dataTypes.varchar(length);
    }

    // Map common types
    const typeMap: Record<string, keyof DatabaseSyntaxConfig['dataTypes']> = {
      'text': 'text',
      'string': 'text',
      'int': 'integer',
      'int8': 'integer',
      'integer': 'integer',
      'bool': 'boolean',
      'boolean': 'boolean',
      'timestamp': 'timestamp',
      'datetime': 'timestamp',
      'decimal': 'decimal',
      'numeric': 'decimal'
    };

    const mappedType = typeMap[lowerType];
    if (mappedType && typeof config.dataTypes[mappedType] === 'string') {
      return config.dataTypes[mappedType] as string;
    }

    // Return as-is if no mapping found
    return genericType.toUpperCase();
  }

  /**
   * Generate AI system prompt for specific database provider
   */
  public static generateDatabaseSpecificPrompt(provider: DatabaseProvider): string {
    const config = this.getSyntaxConfig(provider);
    
    // Map provider to readable name
    const getProviderName = (provider: string): string => {
      if (provider.includes('mysql')) return 'MYSQL';
      if (provider.includes('postgres')) return 'POSTGRESQL';
      if (provider.includes('sqlite')) return 'SQLITE';
      return provider.toUpperCase();
    };
    
    const providerName = getProviderName(provider);
    const basePrompt = `You are a SQL database schema expert. Generate clean, production-ready SQL CREATE TABLE statements based on user requirements.

Rules:
1. Use ${providerName} syntax specifically
2. Include appropriate data types
3. Add PRIMARY KEY constraints where appropriate
4. Include FOREIGN KEY relationships when tables are related
5. Use meaningful column names
6. Add NOT NULL constraints where appropriate
7. Only return the SQL statements, no explanations
8. Separate multiple tables with semicolons
9. Use proper indentation and formatting

`;

    // Add database-specific examples and syntax rules
    if (provider.includes('mysql') || provider === 'mysql' || provider === 'planetscale') {
        return basePrompt + `
MYSQL/MariaDB Specific Rules:
- Use AUTO_INCREMENT for auto-incrementing primary keys (NOT SERIAL)
- Use INT, VARCHAR, TEXT, BOOLEAN, TIMESTAMP data types
- Use backticks for table/column names if they conflict with keywords
- Default values: DEFAULT NOW() for timestamps

Example output:
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);`;

    } else if (provider.includes('sqlite') || provider === 'sqlite') {
        return basePrompt + `
SQLITE Specific Rules:
- Use INTEGER PRIMARY KEY AUTOINCREMENT for auto-incrementing keys
- Use INTEGER, TEXT, REAL data types (no VARCHAR, use TEXT instead)
- Use INTEGER for boolean values (0/1)
- Use TEXT for timestamps
- Be careful with foreign keys (may need PRAGMA foreign_keys=ON)

Example output:
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    published INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);`;

    } else if (provider === 'supabase') {
        return basePrompt + `
SUPABASE/PostgreSQL Specific Rules:
- Use SERIAL for auto-incrementing primary keys
- Use TEXT, INTEGER, BOOLEAN, TIMESTAMP WITH TIME ZONE data types
- Include RLS (Row Level Security) considerations
- Use gen_random_uuid() for UUIDs
- Default values: DEFAULT NOW() for timestamps

Example output:
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`;

    } else {
      // Default to PostgreSQL for postgres-local and unknown providers
        return basePrompt + `
POSTGRESQL Specific Rules:
- Use SERIAL for auto-incrementing primary keys
- Use TEXT, INTEGER, BOOLEAN, TIMESTAMP data types
- Support for advanced types like JSON, UUID, ARRAY
- Default values: DEFAULT NOW() for timestamps

Example output:
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title TEXT NOT NULL,
    content TEXT,
    published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);`;
    }
  }

  /**
   * Convert existing SQL from one database to another
   */
  public static convertSQL(
    sql: string, 
    fromProvider: DatabaseProvider, 
    toProvider: DatabaseProvider
  ): string {
    if (fromProvider === toProvider) return sql;

    const fromConfig = this.getSyntaxConfig(fromProvider);
    const toConfig = this.getSyntaxConfig(toProvider);

    let convertedSQL = sql;

    // Convert auto-increment syntax
    if (fromProvider === 'postgresql' && (toProvider === 'mysql' || toProvider === 'planetscale')) {
      // Convert SERIAL to AUTO_INCREMENT
      convertedSQL = convertedSQL.replace(/(\w+)\s+SERIAL\s+PRIMARY\s+KEY/gi, '$1 INT AUTO_INCREMENT PRIMARY KEY');
      convertedSQL = convertedSQL.replace(/(\w+)\s+SERIAL/gi, '$1 INT AUTO_INCREMENT');
    }

    if ((fromProvider === 'mysql' || fromProvider === 'planetscale') && toProvider === 'postgresql') {
      // Convert AUTO_INCREMENT to SERIAL
      convertedSQL = convertedSQL.replace(/(\w+)\s+INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, '$1 SERIAL PRIMARY KEY');
      convertedSQL = convertedSQL.replace(/(\w+)\s+INT\s+AUTO_INCREMENT/gi, '$1 SERIAL');
    }

    if (toProvider === 'sqlite') {
      // Convert to SQLite syntax
      convertedSQL = convertedSQL.replace(/(\w+)\s+SERIAL\s+PRIMARY\s+KEY/gi, '$1 INTEGER PRIMARY KEY AUTOINCREMENT');
      convertedSQL = convertedSQL.replace(/(\w+)\s+INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, '$1 INTEGER PRIMARY KEY AUTOINCREMENT');
      convertedSQL = convertedSQL.replace(/VARCHAR\(\d+\)/gi, 'TEXT');
      convertedSQL = convertedSQL.replace(/BOOLEAN/gi, 'INTEGER');
      convertedSQL = convertedSQL.replace(/TIMESTAMP/gi, 'TEXT');
      convertedSQL = convertedSQL.replace(/NOW\(\)/gi, "datetime('now')");
    }

    return convertedSQL;
  }
}