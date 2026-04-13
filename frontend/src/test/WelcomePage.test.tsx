import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WelcomePage from '../pages/WelcomePage';

// Mock UserContext
const mockRegister = vi.fn();
const mockCheckUsername = vi.fn();
const mockLogout = vi.fn();

vi.mock('../contexts/UserContext', () => ({
  useUser: () => ({
    user: null,
    loading: false,
    register: mockRegister,
    checkUsername: mockCheckUsername,
    logout: mockLogout,
  }),
}));

// Mock antd-mobile Toast (Dialog is now declarative, no need to mock)
vi.mock('antd-mobile', async () => {
  const actual = await vi.importActual('antd-mobile');
  return {
    ...actual,
    Toast: { show: vi.fn() },
  };
});

function renderWelcome(initialEntries: string[] = ['/welcome'], state?: any) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: initialEntries[0], state }]}>
      <WelcomePage />
    </MemoryRouter>
  );
}

describe('WelcomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckUsername.mockResolvedValue(false);
    mockRegister.mockResolvedValue(undefined);
  });

  it('should render the welcome form', () => {
    renderWelcome();
    expect(screen.getByText('德扑记分')).toBeDefined();
    expect(screen.getByPlaceholderText('输入你的昵称')).toBeDefined();
    expect(screen.getByText('开始使用')).toBeDefined();
  });

  it('should show invite context when redirected from /join/:roomCode', () => {
    renderWelcome(['/welcome'], { from: '/join/ABC123' });
    expect(screen.getByText(/你正在被邀请加入房间/)).toBeDefined();
    expect(screen.getByText(/#ABC123/)).toBeDefined();
  });

  it('should not show invite context for normal login', () => {
    renderWelcome();
    expect(screen.queryByText(/你正在被邀请加入房间/)).toBeNull();
  });

  it('should call checkUsername before registering', async () => {
    const user = userEvent.setup();
    renderWelcome();

    const input = screen.getByPlaceholderText('输入你的昵称');
    await user.type(input, 'newuser');
    await user.click(screen.getByText('开始使用'));

    expect(mockCheckUsername).toHaveBeenCalledWith('newuser');
  });

  it('should register directly for new username', async () => {
    const user = userEvent.setup();
    mockCheckUsername.mockResolvedValue(false);
    renderWelcome();

    const input = screen.getByPlaceholderText('输入你的昵称');
    await user.type(input, 'brandnew');
    await user.click(screen.getByText('开始使用'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('brandnew');
    });
  });

  it('should show conflict dialog for existing username', async () => {
    const user = userEvent.setup();
    mockCheckUsername.mockResolvedValue(true);
    renderWelcome();

    const input = screen.getByPlaceholderText('输入你的昵称');
    await user.type(input, 'existinguser');
    await user.click(screen.getByText('开始使用'));

    await waitFor(() => {
      expect(screen.getByText('该用户名已存在')).toBeDefined();
      expect(screen.getByText(/是否要以/)).toBeDefined();
      expect(screen.getByText(/我们是通过用户名来确认身份哦/)).toBeDefined();
    });
  });

  it('should register when user confirms login for existing username', async () => {
    const user = userEvent.setup();
    mockCheckUsername.mockResolvedValue(true);
    renderWelcome();

    const input = screen.getByPlaceholderText('输入你的昵称');
    await user.type(input, 'existinguser');
    await user.click(screen.getByText('开始使用'));

    await waitFor(() => {
      expect(screen.getByText('该用户名已存在')).toBeDefined();
    });

    // Click the "登录" button in the dialog
    fireEvent.click(screen.getByText('登录'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('existinguser');
    });
  });

  it('should not register when user cancels confirm dialog', async () => {
    const user = userEvent.setup();
    mockCheckUsername.mockResolvedValue(true);
    renderWelcome();

    const input = screen.getByPlaceholderText('输入你的昵称');
    await user.type(input, 'existinguser');
    await user.click(screen.getByText('开始使用'));

    await waitFor(() => {
      expect(screen.getByText('该用户名已存在')).toBeDefined();
    });

    // Click "取消" using fireEvent (antd-mobile dialog has pointer-events restrictions)
    fireEvent.click(screen.getByText('取消'));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('should show toast for empty username', async () => {
    const user = userEvent.setup();
    const { Toast } = await import('antd-mobile');

    renderWelcome();
    await user.click(screen.getByText('开始使用'));

    expect(Toast.show).toHaveBeenCalledWith({ content: '请输入昵称' });
    expect(mockCheckUsername).not.toHaveBeenCalled();
  });
});
