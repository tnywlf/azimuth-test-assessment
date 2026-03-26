import { Response } from "express";
import {
  assignTenant,
  createProperty,
  getProperties,
  updateProperty,
} from "../src/controllers/property.controller";
import { supabase } from "../src/config/supabase";

jest.mock("../src/config/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("../src/services/notification.service", () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

const mockSupabase = supabase as any;

const createMockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe("property.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("createProperty returns 400 when title/address are missing", async () => {
    const req = {
      user: { id: "u1", role: "landlord" },
      body: { title: "", address: "" },
    } as any;
    const res = createMockResponse();

    await createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "title and address are required",
    });
  });

  it("createProperty returns 400 when agent does not provide landlord_id", async () => {
    const req = {
      user: { id: "a1", role: "agent" },
      body: { title: "Unit A", address: "123 Street" },
    } as any;
    const res = createMockResponse();

    await createProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "landlord_id is required when agent creates property",
    });
  });

  it("assignTenant returns 400 when tenant_id is missing", async () => {
    const req = {
      user: { id: "u1", role: "landlord" },
      params: { id: "p1" },
      body: {},
    } as any;
    const res = createMockResponse();

    await assignTenant(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "tenant_id is required" });
  });

  it("updateProperty returns 404 when property does not exist", async () => {
    const single = jest.fn().mockResolvedValue({ data: null });
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "properties") {
        return { select };
      }
      return {};
    });

    const req = {
      user: { id: "u1", role: "landlord" },
      params: { id: "missing-property" },
      body: { title: "Updated" },
    } as any;
    const res = createMockResponse();

    await updateProperty(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Property not found" });
  });

  it("getProperties returns empty list for tenant with no assignments", async () => {
    const tenantEq = jest.fn().mockResolvedValue({ data: [] });
    const tenantSelect = jest.fn().mockReturnValue({ eq: tenantEq });
    const propertiesSelect = jest.fn().mockReturnValue({});

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "property_tenants") {
        return { select: tenantSelect };
      }
      if (table === "properties") {
        return { select: propertiesSelect };
      }
      return {};
    });

    const req = {
      user: { id: "tenant-1", role: "tenant" },
    } as any;
    const res = createMockResponse();

    await getProperties(req, res);

    expect(res.json).toHaveBeenCalledWith({ data: [] });
  });
});
