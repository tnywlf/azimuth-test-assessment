import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { propertiesApi, usersApi } from "../services/api";
import { Profile } from "../types";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

export default function CreateProperty() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [landlords, setLandlords] = useState<Profile[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    property_type: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    rent_amount: 0,
    landlord_id: "",
  });

  useEffect(() => {
    // If agent, load landlords to assign
    if (profile?.role === "agent") {
      usersApi.list("landlord").then((res) => {
        setLandlords(res.data.data || []);
      });
    }
  }, [profile]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "bedrooms" || name === "bathrooms" || name === "rent_amount"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const data: Record<string, unknown> = { ...form };
      if (profile?.role === "landlord") {
        delete data.landlord_id;
      }
      await propertiesApi.create(data);
      navigate("/properties");
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to create property"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={18} /> Back
      </button>

      <div className="form-card">
        <h1>Add New Property</h1>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="title">Property Title *</label>
              <input
                id="title"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Modern Downtown Apartment"
                required
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the property..."
                rows={3}
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="address">Address *</label>
              <input
                id="address"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="123 Main Street"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="New York"
              />
            </div>

            <div className="form-group">
              <label htmlFor="state">State</label>
              <input
                id="state"
                name="state"
                value={form.state}
                onChange={handleChange}
                placeholder="NY"
              />
            </div>

            <div className="form-group">
              <label htmlFor="zip_code">ZIP Code</label>
              <input
                id="zip_code"
                name="zip_code"
                value={form.zip_code}
                onChange={handleChange}
                placeholder="10001"
              />
            </div>

            <div className="form-group">
              <label htmlFor="property_type">Type</label>
              <select
                id="property_type"
                name="property_type"
                value={form.property_type}
                onChange={handleChange}
              >
                <option value="apartment">Apartment</option>
                <option value="house">House</option>
                <option value="condo">Condo</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="bedrooms">Bedrooms</label>
              <input
                id="bedrooms"
                name="bedrooms"
                type="number"
                min={0}
                value={form.bedrooms}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="bathrooms">Bathrooms</label>
              <input
                id="bathrooms"
                name="bathrooms"
                type="number"
                min={0}
                value={form.bathrooms}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="rent_amount">Monthly Rent ($)</label>
              <input
                id="rent_amount"
                name="rent_amount"
                type="number"
                min={0}
                value={form.rent_amount}
                onChange={handleChange}
              />
            </div>

            {profile?.role === "agent" && (
              <div className="form-group full-width">
                <label htmlFor="landlord_id">Assign to Landlord *</label>
                <select
                  id="landlord_id"
                  name="landlord_id"
                  value={form.landlord_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select a landlord...</option>
                  {landlords.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.full_name} ({l.email})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Property"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
