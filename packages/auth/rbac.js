'use strict';

const { DomainError } = require('../shared/errors');

const ROLES = Object.freeze([
  'ADMIN',
  'PLANNING_MANAGER',
  'PLANNER',
  'SALES',
  'PROJECT_MANAGER',
  'FINANCE',
  'READ_ONLY',
]);

const ROLE_PERMISSIONS = Object.freeze({
  ADMIN: ['*'],
  PLANNING_MANAGER: ['planning.read', 'planning.write', 'planning.validate', 'planning.override_conflict', 'project.read', 'resource.read', 'quote.read'],
  PLANNER: ['planning.read', 'planning.write', 'project.read', 'resource.read', 'quote.read'],
  SALES: ['client.read', 'client.manage', 'project.read', 'project.manage', 'quote.read', 'quote.manage'],
  PROJECT_MANAGER: ['client.read', 'project.read', 'project.manage', 'planning.read', 'quote.read'],
  FINANCE: ['client.read', 'project.read', 'quote.read', 'finance.read', 'audit.read'],
  READ_ONLY: ['client.read', 'project.read', 'planning.read', 'resource.read', 'quote.read'],
});

function permissionsForRoles(roleCodes) {
  const roles = [...new Set(roleCodes || [])];
  if (roles.some(role => !ROLES.includes(role))) throw new DomainError('ROLE_UNKNOWN', 'Un rôle est inconnu.', { details: { roleCodes: roles } });
  const permissions = new Set(roles.flatMap(role => ROLE_PERMISSIONS[role]));
  return permissions.has('*') ? new Set(['*']) : permissions;
}

function standardRoleDefinitions(companyId) {
  if (!companyId) throw new DomainError('COMPANY_SCOPE_REQUIRED', 'La société est requise.');
  return ROLES.map(code => ({ code, companyId, permissions: [...ROLE_PERMISSIONS[code]], systemManaged: true, active: true }));
}

function authorize(context, permission, target = {}) {
  const permissions = permissionsForRoles(context.roleCodes);
  if (!permissions.has('*') && !permissions.has(permission)) throw new DomainError('FORBIDDEN', 'Action non autorisée.', { status: 403 });
  if (!context.companyId || target.companyId !== context.companyId) throw new DomainError('NOT_FOUND', 'Élément introuvable.', { status: 404 });
  if (target.siteId && !context.organizationScope && !(context.siteIds || []).includes(target.siteId)) throw new DomainError('NOT_FOUND', 'Élément introuvable.', { status: 404 });
  if (target.projectId && Array.isArray(context.projectIds) && !context.projectIds.includes(target.projectId)) throw new DomainError('NOT_FOUND', 'Élément introuvable.', { status: 404 });
  const entityIds = target.entityType && context.entityScopes?.[target.entityType];
  if (target.entityId && Array.isArray(entityIds) && !entityIds.includes(target.entityId)) throw new DomainError('NOT_FOUND', 'Élément introuvable.', { status: 404 });
  return true;
}

module.exports = { ROLES, ROLE_PERMISSIONS, standardRoleDefinitions, permissionsForRoles, authorize };
