-- Audit types for dashboard layout admin actions + cleanup subuser layout rows

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_action_type_check;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_action_type_check
  CHECK (action_type IN (
    'CREATE_USER', 'UPDATE_USER', 'BLOCK_USER', 'UNBLOCK_USER', 'UPDATE_PERMISSION',
    'CREATE_MODULE', 'UPDATE_MODULE', 'DELETE_MODULE',
    'CREATE_DYNAMIC_TABLE', 'UPDATE_DYNAMIC_TABLE', 'DELETE_DYNAMIC_TABLE', 'UPDATE_TABLE_COLUMNS',
    'CREATE_CHART', 'UPDATE_CHART', 'DELETE_CHART',
    'IMPORT_EXCEL', 'UPDATE_PASSWORD', 'UPDATE_DATA_ACCESS',
    'RESTORE', 'SYSTEM',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED_BY_RATE_LIMIT', 'LOGIN_BLOCKED_IP',
    'LOGIN_BLOCKED_MAINTENANCE', 'UPDATE_MAINTENANCE_MODE',
    'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FILE_MOVE', 'FILE_SHARE', 'BULK_FILE_MOVE',
    'FOLDER_CREATE', 'FOLDER_DELETE',
    'IMPERSONATION_START', 'IMPERSONATION_END',
    'MODULE_VIEW', 'DOCUMENT_GENERATE',
    'UPDATE_DASHBOARD_LAYOUT', 'UPDATE_PLATFORM_DASHBOARD'
  ));

-- Subusers inherit from principal; remove orphaned per-subuser layout rows
DELETE FROM public.dashboard_layouts dl
USING public.profiles p
WHERE dl.user_id = p.id AND p.parent_user_id IS NOT NULL;
