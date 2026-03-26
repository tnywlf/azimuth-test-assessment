import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

const navigateMock = jest.fn();
const signOutMock = jest.fn().mockResolvedValue(undefined);

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

jest.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: { full_name: "Jane Doe", role: "agent" },
    signOut: signOutMock,
  }),
}));

jest.mock("../hooks/useUnread", () => ({
  useUnreadCount: () => ({ unreadCount: 3 }),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    signOutMock.mockClear();
  });

  it("renders user role and unread badge", () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("signs out and navigates to login", async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith("/login");
    });
  });
});
