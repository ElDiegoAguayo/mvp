-- Expand audit log action type check constraint
alter table public.audit_logs
  drop constraint if exists audit_logs_action_type_check;

alter table public.audit_logs
  add constraint audit_logs_action_type_check
  check (action_type in (
    'CREATE_USER',
    'UPDATE_USER',
    'BLOCK_USER',
    'UNBLOCK_USER',
    'UPDATE_PERMISSION',
    'CREATE_MODULE',
    'UPDATE_MODULE',
    'DELETE_MODULE',
    'CREATE_DYNAMIC_TABLE',
    'UPDATE_DYNAMIC_TABLE',
    'DELETE_DYNAMIC_TABLE',
    'UPDATE_TABLE_COLUMNS',
    'CREATE_CHART',
    'UPDATE_CHART',
    'DELETE_CHART',
    'IMPORT_EXCEL',
    'UPDATE_PASSWORD',
    'UPDATE_DATA_ACCESS',
    'RESTORE',
    'SYSTEM',
    'LOGIN_BLOCKED_BY_RATE_LIMIT',
    'LOGIN_FAILED',
    'LOGIN_SUCCESS'
  ));
