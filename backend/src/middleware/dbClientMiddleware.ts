import { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import db, { schemaNames } from '../database/db';
import logger from '../utils/logger';

export interface dbClientPool {
  mainPool: PoolClient;
  tenantPool?: PoolClient;
}

// Extend Express Request interface to include database pools
declare global {
  namespace Express {
    interface Request {
      db: dbClientPool;
    }
  }
}

interface DatabaseError extends Error {
  code?: string;
  detail?: string;
}

export async function dbClientMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tenantSchemaName = req.headers['x-tenant-schema'] as string | undefined;

  try {
    // Initialize the db object on the request
    req.db = {} as dbClientPool;
    
    // Always get a pool for the main schema
    req.db.mainPool = await db.getSchemaPool(schemaNames.main);

    // Get tenant-specific schema pool if provided
    if (tenantSchemaName) {
      req.db.tenantPool = await db.getSchemaPool(`tenant_${tenantSchemaName}`);
    }

    res.on('finish', () => {
      try {
        if (
          req.db.tenantPool?.release &&
          typeof req.db.tenantPool?.release === 'function'
        ) {
          req.db.tenantPool.release(true);
        }

        if (
          req.db.mainPool?.release &&
          typeof req.db.mainPool?.release === 'function'
        ) {
          req.db.mainPool.release(true);
        }
      } catch (releaseError) {
        logger.error('Error releasing database connections:', releaseError);
      }
    });

    next();
  } catch (err: unknown) {
    const error = err as DatabaseError;
    logger.error('dbClientMiddleware error:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Database connection error',
      message:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
    });
  }
}
