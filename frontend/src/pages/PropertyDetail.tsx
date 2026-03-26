import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { propertiesApi, usersApi } from "../services/api";
import { Property, Profile } from "../types";
import {
  ArrowLeft,
  MapPin,
  Bed,
  Bath,
  DollarSign,
  Users,
  UserPlus,
  Trash2,
  Calendar,
  Home,
  Building2,
  Mail,
  Phone,
  Shield,
  Clock,
  X,
  Check,
} from "lucide-react";
import { format } from "date-fns";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile: currentUser } = useAuth();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [tenants, setTenants] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [leaseStart, setLeaseStart] = useState("");
  const [leaseEnd, setLeaseEnd] = useState("");

  const canManage =
    currentUser?.role === "landlord" || currentUser?.role === "agent";

  useEffect(() => {
    loadProperty();
    if (canManage) loadTenants();
  }, [id]);

  const loadProperty = async () => {
    try {
      const res = await propertiesApi.getById(id!);
      setProperty(res.data.data);
    } catch {
      navigate("/properties");
    } finally {
      setLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const res = await usersApi.list("tenant");
      setTenants(res.data.data || []);
    } catch {
      /* ignore */
    }
  };

  const handleAssignTenant = async () => {
    if (!selectedTenant) return;
    try {
      await propertiesApi.assignTenant(id!, {
        tenant_id: selectedTenant,
        lease_start: leaseStart || undefined,
        lease_end: leaseEnd || undefined,
      });
      setShowAssign(false);
      setSelectedTenant("");
      setLeaseStart("");
      setLeaseEnd("");
      loadProperty();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to assign tenant");
    }
  };

  const handleRemoveTenant = async (tenantId: string) => {
    if (!confirm("Remove this tenant from the property?")) return;
    try {
      await propertiesApi.removeTenant(id!, tenantId);
      loadProperty();
    } catch {
      alert("Failed to remove tenant");
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (!property) return null;

  const assignedTenantIds = new Set(
    property.property_tenants?.map((pt) => pt.tenant_id) || []
  );
  const availableTenants = tenants.filter((t) => !assignedTenantIds.has(t.id));

  const statusConfig = {
    available: { class: "badge-success", icon: <Check size={12} /> },
    occupied: { class: "badge-primary", icon: <Shield size={12} /> },
    maintenance: { class: "badge-warning", icon: <Clock size={12} /> },
  };
  const statusCfg = statusConfig[property.status] || statusConfig.available;

  const typeIcons: Record<string, JSX.Element> = {
    apartment: <Building2 size={20} />,
    house: <Home size={20} />,
    condo: <Building2 size={20} />,
    commercial: <Building2 size={20} />,
  };

  return (
    <div className="page">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Back
      </button>

      {/* ─── Hero Section ─── */}
      <div className="pd-hero">
        <div className="pd-hero-icon">
          {typeIcons[property.property_type] || <Home size={20} />}
        </div>
        <div className="pd-hero-content">
          <div className="pd-hero-top">
            <div>
              <h1 className="pd-title">{property.title}</h1>
              <div className="pd-address">
                <MapPin size={16} />
                <span>
                  {property.address}
                  {property.city ? `, ${property.city}` : ""}
                  {property.state ? `, ${property.state}` : ""}
                  {property.zip_code ? ` ${property.zip_code}` : ""}
                </span>
              </div>
            </div>
            <span className={`badge badge-lg ${statusCfg.class}`}>
              {statusCfg.icon} {property.status}
            </span>
          </div>

          {property.description && (
            <p className="pd-description">{property.description}</p>
          )}

          {/* Stats Row */}
          <div className="pd-stats-row">
            <div className="pd-stat">
              <div className="pd-stat-icon pd-stat-icon--blue">
                <Bed size={18} />
              </div>
              <div className="pd-stat-text">
                <span className="pd-stat-value">{property.bedrooms || 0}</span>
                <span className="pd-stat-label">Bedrooms</span>
              </div>
            </div>
            <div className="pd-stat">
              <div className="pd-stat-icon pd-stat-icon--teal">
                <Bath size={18} />
              </div>
              <div className="pd-stat-text">
                <span className="pd-stat-value">
                  {property.bathrooms || 0}
                </span>
                <span className="pd-stat-label">Bathrooms</span>
              </div>
            </div>
            <div className="pd-stat">
              <div className="pd-stat-icon pd-stat-icon--green">
                <DollarSign size={18} />
              </div>
              <div className="pd-stat-text">
                <span className="pd-stat-value">
                  ${Number(property.rent_amount || 0).toLocaleString()}
                </span>
                <span className="pd-stat-label">Per Month</span>
              </div>
            </div>
            <div className="pd-stat">
              <div className="pd-stat-icon pd-stat-icon--purple">
                <Users size={18} />
              </div>
              <div className="pd-stat-text">
                <span className="pd-stat-value">
                  {property.property_tenants?.length || 0}
                </span>
                <span className="pd-stat-label">Tenants</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content Grid ─── */}
      <div className="pd-grid">
        {/* Left Column: Info Cards */}
        <div className="pd-left">
          <div className="pd-card">
            <div className="pd-card-header">
              <Home size={16} />
              <h3>Property Details</h3>
            </div>
            <div className="pd-card-body">
              <div className="pd-detail-row">
                <span className="pd-detail-label">Type</span>
                <span className="pd-detail-value pd-capitalize">
                  {property.property_type}
                </span>
              </div>
              <div className="pd-detail-row">
                <span className="pd-detail-label">Status</span>
                <span className={`badge badge-sm ${statusCfg.class}`}>
                  {property.status}
                </span>
              </div>
              <div className="pd-detail-row">
                <span className="pd-detail-label">Created</span>
                <span className="pd-detail-value">
                  {format(new Date(property.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>

          {property.landlord && (
            <div className="pd-card">
              <div className="pd-card-header">
                <Shield size={16} />
                <h3>Landlord</h3>
              </div>
              <div className="pd-card-body">
                <div className="pd-person">
                  <div className="pd-person-avatar pd-person-avatar--blue">
                    {property.landlord.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="pd-person-info">
                    <span className="pd-person-name">
                      {property.landlord.full_name}
                    </span>
                    <span className="pd-person-detail">
                      <Mail size={12} /> {property.landlord.email}
                    </span>
                    {property.landlord.phone && (
                      <span className="pd-person-detail">
                        <Phone size={12} /> {property.landlord.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {property.agent && (
            <div className="pd-card">
              <div className="pd-card-header">
                <Users size={16} />
                <h3>Agent</h3>
              </div>
              <div className="pd-card-body">
                <div className="pd-person">
                  <div className="pd-person-avatar pd-person-avatar--green">
                    {property.agent.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div className="pd-person-info">
                    <span className="pd-person-name">
                      {property.agent.full_name}
                    </span>
                    <span className="pd-person-detail">
                      <Mail size={12} /> {property.agent.email}
                    </span>
                    {property.agent.phone && (
                      <span className="pd-person-detail">
                        <Phone size={12} /> {property.agent.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Tenants */}
        <div className="pd-right">
          <div className="pd-card pd-card--full">
            <div className="pd-card-header">
              <Users size={16} />
              <h3>Tenants</h3>
              {canManage && (
                <button
                  className="btn btn-primary btn-sm pd-card-action"
                  onClick={() => setShowAssign(!showAssign)}
                >
                  {showAssign ? (
                    <>
                      <X size={14} /> Cancel
                    </>
                  ) : (
                    <>
                      <UserPlus size={14} /> Assign
                    </>
                  )}
                </button>
              )}
            </div>

            {showAssign && (
              <div className="pd-assign-form">
                <div className="form-group">
                  <label>Select Tenant</label>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                  >
                    <option value="">Choose a tenant...</option>
                    {availableTenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pd-assign-dates">
                  <div className="form-group">
                    <label>Lease Start</label>
                    <input
                      type="date"
                      value={leaseStart}
                      onChange={(e) => setLeaseStart(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Lease End</label>
                    <input
                      type="date"
                      value={leaseEnd}
                      onChange={(e) => setLeaseEnd(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  className="btn btn-primary btn-block"
                  onClick={handleAssignTenant}
                  disabled={!selectedTenant}
                >
                  <UserPlus size={16} /> Assign Tenant
                </button>
              </div>
            )}

            <div className="pd-card-body">
              {property.property_tenants &&
              property.property_tenants.length > 0 ? (
                <div className="pd-tenants-list">
                  {property.property_tenants.map((pt) => (
                    <div key={pt.id} className="pd-tenant-card">
                      <div className="pd-tenant-left">
                        <div className="pd-person-avatar pd-person-avatar--purple">
                          {pt.tenant?.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="pd-tenant-info">
                          <span className="pd-tenant-name">
                            {pt.tenant?.full_name || "Unknown"}
                          </span>
                          <span className="pd-tenant-email">
                            {pt.tenant?.email}
                          </span>
                          {pt.lease_start && (
                            <span className="pd-tenant-lease">
                              <Calendar size={12} />
                              {format(new Date(pt.lease_start), "MMM d, yyyy")}
                              {pt.lease_end &&
                                ` — ${format(
                                  new Date(pt.lease_end),
                                  "MMM d, yyyy"
                                )}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="pd-tenant-right">
                        <span
                          className={`badge badge-sm ${
                            pt.status === "active"
                              ? "badge-success"
                              : pt.status === "pending"
                              ? "badge-warning"
                              : "badge-danger"
                          }`}
                        >
                          {pt.status}
                        </span>
                        {canManage && (
                          <button
                            className="btn btn-ghost btn-sm btn-danger-text"
                            onClick={() => handleRemoveTenant(pt.tenant_id)}
                            title="Remove tenant"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pd-empty-tenants">
                  <Users size={32} />
                  <p>No tenants assigned yet</p>
                  {canManage && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowAssign(true)}
                    >
                      <UserPlus size={14} /> Assign First Tenant
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
