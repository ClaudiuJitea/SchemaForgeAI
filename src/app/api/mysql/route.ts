import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

interface MySQLConfig {
  host?: string;
  port?: number;
  user?: string;
  username?: string;
  password?: string;
  database?: string;
  connectionString?: string;
}

interface MySQLRequest {
  config: MySQLConfig;
  query: string;
  operation: 'execute' | 'test' | 'info';
}

export async function POST(request: NextRequest) {
  try {
    const body: MySQLRequest = await request.json();
    const { config, query, operation } = body;

    // Create connection
    const connection = await createConnection(config);

    try {
      switch (operation) {
        case 'test':
          const [versionRows] = await connection.execute('SELECT VERSION() as version');
          const version = (versionRows as any)[0]?.version || 'MySQL 8.0';
          
          await connection.end();
          return NextResponse.json({
            success: true,
            message: 'MySQL connection successful',
            version,
            latency: Date.now()
          });

        case 'info':
          const [versionResult] = await connection.execute('SELECT VERSION() as version');
          const [tablesResult] = await connection.execute('SHOW TABLES');
          const [dbResult] = await connection.execute('SELECT DATABASE() as db_name');
          
          const dbInfo = {
            name: (dbResult as any)[0]?.db_name || config.database || 'mysql',
            version: (versionResult as any)[0]?.version || 'MySQL 8.0',
            tables: (tablesResult as any[]).map(row => Object.values(row)[0]),
            features: [
              'ACID transactions',
              'Foreign key constraints',
              'Triggers',
              'Views',
              'Stored procedures',
              'Indexing',
              'Full-text search',
              'JSON data type',
              'Partitioning'
            ]
          };
          
          await connection.end();
          return NextResponse.json({ success: true, data: dbInfo });

        case 'execute':
          if (!query.trim()) {
            await connection.end();
            return NextResponse.json({
              success: false,
              message: 'No query provided'
            });
          }

          // Clean and parse SQL statements
          const cleanedQuery = query
            .split('\n')
            .filter(line => !line.trim().startsWith('--')) // Remove comments
            .join('\n')
            .replace(/START TRANSACTION\s*;?/gi, '') // Remove transaction statements
            .replace(/COMMIT\s*;?/gi, '')
            .replace(/BEGIN\s*;?/gi, '')
            .trim();

          const statements = cleanedQuery
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

          const results = [];
          let tablesCreated = 0;
          let rowsAffected = 0;

          // Start transaction manually
          await connection.beginTransaction();

          try {
            for (const statement of statements) {
              if (!statement) continue;

              const [result] = await connection.execute(statement);
              results.push(result);

              if (statement.toUpperCase().startsWith('CREATE TABLE')) {
                tablesCreated++;
              }

              if (typeof result === 'object' && result !== null && 'affectedRows' in result) {
                rowsAffected += (result as any).affectedRows || 0;
              }
            }

            // Commit transaction
            await connection.commit();
          } catch (error) {
            // Rollback on error
            await connection.rollback();
            await connection.end();
            return NextResponse.json({
              success: false,
              message: `Failed to execute statement: ${error instanceof Error ? error.message : 'Unknown error'}`,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }

          await connection.end();
          return NextResponse.json({
            success: true,
            message: `Query executed successfully. ${tablesCreated} tables created, ${rowsAffected} rows affected.`,
            results,
            tablesCreated,
            rowsAffected,
            executedStatements: statements
          });

        default:
          await connection.end();
          return NextResponse.json({
            success: false,
            message: 'Invalid operation'
          });
      }
    } catch (error) {
      await connection.end();
      throw error;
    }
  } catch (error) {
    console.error('MySQL API Error:', error);
    return NextResponse.json({
      success: false,
      message: `MySQL operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function createConnection(config: MySQLConfig) {
  if (config.connectionString) {
    // Parse connection string
    const url = new URL(config.connectionString);
    return await mysql.createConnection({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1), // Remove leading slash
      ssl: url.searchParams.get('ssl') === 'true' ? {} : false,
      connectTimeout: 30000,
      acquireTimeout: 30000,
      timeout: 30000
    });
  } else {
    // Use individual config properties
    return await mysql.createConnection({
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user || config.username || 'root',
      password: config.password || '',
      database: config.database || '',
      connectTimeout: 30000,
      acquireTimeout: 30000,
      timeout: 30000
    });
  }
}