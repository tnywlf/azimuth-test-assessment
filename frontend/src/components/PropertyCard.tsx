import { useNavigate } from "react-router-dom";
import { Property } from "../types";
import {
  MapPin,
  Bed,
  Bath,
  DollarSign,
  Users,
  Home,
  Building2,
} from "lucide-react";

interface Props {
  property: Property;
}

export default function PropertyCard({ property }: Props) {
  const navigate = useNavigate();

  const statusClass =
    property.status === "available"
      ? "badge-success"
      : property.status === "occupied"
      ? "badge-primary"
      : "badge-warning";

  const typeIcons: Record<string, JSX.Element> = {
    apartment: <Building2 size={18} />,
    house: <Home size={18} />,
    condo: <Building2 size={18} />,
    commercial: <Building2 size={18} />,
  };

  return (
    <div
      className="pc-card"
      onClick={() => navigate(`/properties/${property.id}`)}
    >
      {/* Card Banner */}
      <div className="pc-banner">
        <div className="pc-type-icon">
          {typeIcons[property.property_type] || <Home size={18} />}
        </div>
        <span className={`badge ${statusClass}`}>{property.status}</span>
      </div>

      {/* Card Body */}
      <div className="pc-body">
        <h3 className="pc-title">{property.title}</h3>
        <div className="pc-address">
          <MapPin size={14} />
          <span>
            {property.address}
            {property.city ? `, ${property.city}` : ""}
            {property.state ? `, ${property.state}` : ""}
          </span>
        </div>

        {/* Stats */}
        <div className="pc-stats">
          <div className="pc-stat">
            <Bed size={14} />
            <span>{property.bedrooms || 0}</span>
          </div>
          <div className="pc-stat">
            <Bath size={14} />
            <span>{property.bathrooms || 0}</span>
          </div>
          <div className="pc-stat">
            <Users size={14} />
            <span>{property.property_tenants?.length || 0}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pc-footer">
          <div className="pc-price">
            <DollarSign size={14} />
            <span>${Number(property.rent_amount || 0).toLocaleString()}</span>
            <small>/mo</small>
          </div>
          {property.landlord && (
            <div className="pc-owner">
              <div className="pc-owner-avatar">
                {property.landlord.full_name?.charAt(0)?.toUpperCase()}
              </div>
              <span>{property.landlord.full_name}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
