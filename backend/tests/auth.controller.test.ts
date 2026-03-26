import { Request, Response } from "express";
import { getMe, loginUser, registerUser } from "../src/controllers/auth.controller";
import { supabase } from "../src/config/supabase";

jest.mock("../src/config/supabase", () => ({
  supabase: {
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
      },
      signInWithPassword: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as any;

const createMockResponse = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

describe("auth.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("registerUser returns 400 for missing required fields", async () => {
    const req = {
      body: { email: "user@test.com", password: "123456" },
    } as Request;
    const res = createMockResponse();

    await registerUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "email, password, full_name, and role are required",
    });
  });

  it("registerUser returns 409 when email already exists", async () => {
    mockSupabase.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User has already been registered" },
    });

    const req = {
      body: {
        email: "exists@test.com",
        password: "123456",
        full_name: "Existing User",
        role: "tenant",
      },
    } as Request;
    const res = createMockResponse();

    await registerUser(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "An account with this email already exists",
    });
  });

  it("loginUser returns 400 for missing email/password", async () => {
    const req = { body: { email: "user@test.com" } } as Request;
    const res = createMockResponse();

    await loginUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "email and password are required",
    });
  });

  it("getMe returns current authenticated profile", async () => {
    const req = {
      user: { id: "u1", full_name: "Jane Doe", role: "agent" },
    } as any;
    const res = createMockResponse();

    await getMe(req, res);

    expect(res.json).toHaveBeenCalledWith({
      data: { id: "u1", full_name: "Jane Doe", role: "agent" },
    });
  });
});
