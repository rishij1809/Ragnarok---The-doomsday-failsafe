import os
import logging
from django.db import connections
from django.db.utils import OperationalError

logger = logging.getLogger(__name__)

class MultiCloudDRDatabaseRouter:
    """
    Dynamic Database Router for Project Ragnarock Multi-Cloud DR System.
    
    Supports:
    - Primary AWS RDS PostgreSQL ('default')
    - Secondary Azure Flexible Server PostgreSQL ('azure_secondary')
    - Dynamic failover switching based on env flag (DR_FAILOVER_ACTIVE)
      or automatic runtime connectivity evaluation.
    """

    def __init__(self):
        self.primary_alias = 'default'
        self.secondary_alias = 'azure_secondary'

    def _is_failover_active(self) -> bool:
        """Check if environment has explicitly triggered failover mode."""
        return os.environ.get('DR_FAILOVER_ACTIVE', 'false').lower() in ('true', '1', 'yes')

    def _get_active_writer(self) -> str:
        """Determine current active write database alias."""
        if self._is_failover_active():
            return self.secondary_alias
        
        # Test primary connectivity if failover isn't explicitly forced
        try:
            conn = connections[self.primary_alias]
            conn.ensure_connection()
            return self.primary_alias
        except (OperationalError, Exception) as exc:
            logger.warning(
                f"[DR-ROUTER] Primary DB '{self.primary_alias}' unavailable ({exc}). "
                f"Routing traffic to Secondary DB '{self.secondary_alias}'."
            )
            return self.secondary_alias

    def db_for_read(self, model, **hints):
        """
        Reads prefer secondary for read-heavy scaling if configured,
        or default to current active database during DR state.
        """
        read_preference = os.environ.get('DR_READ_PREFERENCE', 'primary')
        if read_preference == 'secondary':
            try:
                connections[self.secondary_alias].ensure_connection()
                return self.secondary_alias
            except Exception:
                return self.primary_alias
        return self._get_active_writer()

    def db_for_write(self, model, **hints):
        """Writes always go to current active primary/promoted write database."""
        return self._get_active_writer()

    def allow_relation(self, obj1, obj2, **hints):
        """Allow relations between objects in both databases as schemas are synchronized."""
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """
        Migrations are applied to the primary DB by default, 
        or to the promoted secondary during full DR failover.
        """
        if self._is_failover_active():
            return db == self.secondary_alias
        return db == self.primary_alias
