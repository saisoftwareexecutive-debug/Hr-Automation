import React from 'react';
import { requireAdmin } from '@/lib/auth';
import { getUsers } from '@/lib/db';
import { UsersClient } from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const currentUser = await requireAdmin('/users');
  const initialUsers = await getUsers();

  return <UsersClient initialUsers={initialUsers} currentUser={currentUser} />;
}

