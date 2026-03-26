import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { propertiesApi } from "../services/api";
import { Property } from "../types";
import PropertyCard from "../components/PropertyCard";
import {
  Plus,
  Search,
  Building2,
  Home,
  CheckCircle,
  Clock,
  Wrench,
} from "lucide-react";

export default function Properties() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const res = await propertiesApi.list();
      setProperties(res.data.data || []);
    } catch (err) {
      console.error("Failed to load properties:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = properties.filter((p) => {
    const matchesSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const canCreate = profile?.role === "landlord" || profile?.role === "agent";

  const counts = {
    total: properties.length,
    available: properties.filter((p) => p.status === "available").length,
    occupied: properties.filter((p) => p.status === "occupied").length,
    maintenance: properties.filter((p) => p.status === "maintenance").length,
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Properties</h1>
        {canCreate && (
          <button
            className="btn btn-primary"
            onClick={() => navigate("/properties/new")}
          >
            <Plus size={18} /> Add Property
          </button>
        )}
      </div>

      {/* Summary Stats */}
      {properties.length > 0 && (
        <div className="prop-summary">
          <div
            className={`prop-summary-item ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <div className="prop-summary-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <Home size={18} />
            </div>
            <div className="prop-summary-text">
              <span className="prop-summary-value">{counts.total}</span>
              <span className="prop-summary-label">Total</span>
            </div>
          </div>
          <div
            className={`prop-summary-item ${statusFilter === "available" ? "active" : ""}`}
            onClick={() => setStatusFilter("available")}
          >
            <div className="prop-summary-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <CheckCircle size={18} />
            </div>
            <div className="prop-summary-text">
              <span className="prop-summary-value">{counts.available}</span>
              <span className="prop-summary-label">Available</span>
            </div>
          </div>
          <div
            className={`prop-summary-item ${statusFilter === "occupied" ? "active" : ""}`}
            onClick={() => setStatusFilter("occupied")}
          >
            <div className="prop-summary-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <Clock size={18} />
            </div>
            <div className="prop-summary-text">
              <span className="prop-summary-value">{counts.occupied}</span>
              <span className="prop-summary-label">Occupied</span>
            </div>
          </div>
          <div
            className={`prop-summary-item ${statusFilter === "maintenance" ? "active" : ""}`}
            onClick={() => setStatusFilter("maintenance")}
          >
            <div className="prop-summary-icon" style={{ background: "#fef3c7", color: "#d97706" }}>
              <Wrench size={18} />
            </div>
            <div className="prop-summary-text">
              <span className="prop-summary-value">{counts.maintenance}</span>
              <span className="prop-summary-label">Maintenance</span>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search properties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Building2 size={64} />
          <h3>No properties found</h3>
          <p>
            {properties.length === 0
              ? "Start by creating your first property."
              : "Try adjusting your search or filters."}
          </p>
          {canCreate && properties.length === 0 && (
            <button
              className="btn btn-primary"
              onClick={() => navigate("/properties/new")}
            >
              <Plus size={18} /> Add Property
            </button>
          )}
        </div>
      ) : (
        <div className="properties-grid">
          {filtered.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      )}
    </div>
  );
}
