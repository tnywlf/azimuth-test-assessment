import request from "supertest";
import app from "../src/app";

describe("API route prefix", () => {
  it("does not expose health route outside /api prefix", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Route not found" });
  });
});
