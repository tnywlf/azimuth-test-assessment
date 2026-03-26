import request from "supertest";
import app from "../src/app";

describe("unknown routes", () => {
  it("returns 404 for missing endpoint", async () => {
    const response = await request(app).get("/missing-endpoint");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Route not found" });
  });
});
