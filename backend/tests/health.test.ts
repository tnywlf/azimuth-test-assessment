import request from "supertest";
import app from "../src/app";

describe("GET /api/health", () => {
  it("returns 200 with healthy payload", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      message: "Server is healthy",
    });
  });
});
