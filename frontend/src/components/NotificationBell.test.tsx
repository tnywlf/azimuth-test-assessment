import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotificationBell from "./NotificationBell";

const navigateMock = jest.fn();
const markNotificationReadMock = jest.fn();
const markAllNotificationsReadMock = jest.fn();

jest.mock("react-router-dom", () => {
  const actual = jest.requireActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

jest.mock("../contexts/SocketContext", () => ({
  useSocket: () => ({
    notifications: [
      {
        id: "n1",
        user_id: "u1",
        type: "new_message",
        title: "New message",
        body: "You have a new message",
        read: false,
        data: { conversation_id: "conv-123" },
        created_at: "2026-03-26T10:00:00.000Z",
      },
    ],
    unreadNotificationCount: 1,
    markNotificationRead: markNotificationReadMock,
    markAllNotificationsRead: markAllNotificationsReadMock,
  }),
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    markNotificationReadMock.mockClear();
    markAllNotificationsReadMock.mockClear();
  });

  it("opens panel and renders notification content", () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));

    expect(screen.getByText("New message")).toBeInTheDocument();
    expect(screen.getByText("You have a new message")).toBeInTheDocument();
  });

  it("marks notification read and navigates to conversation", () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /notifications/i }));
    fireEvent.click(screen.getByText("New message"));

    expect(markNotificationReadMock).toHaveBeenCalledWith("n1");
    expect(navigateMock).toHaveBeenCalledWith("/messages/conv-123");
  });
});
