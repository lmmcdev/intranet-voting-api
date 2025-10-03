import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN, DEFAULT_INITIAL_PASSWORD } from '../../config/env.config';
import { Employee } from '../employee/models/employee.model';
import { EmployeeRepository } from '../employee/repositories/EmployeeRepository';
import { PasswordHelper } from '../../common/utils/PasswordHelper';
import { LoginCredentials, AuthToken, TokenPayload, LoginResponse } from './models/auth.model';
import { ChangePasswordResponse } from './models/change-password.model';

export class AuthService {
  private employeeRepository: EmployeeRepository;

  constructor(employeeRepository: EmployeeRepository) {
    this.employeeRepository = employeeRepository;
  }

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Find employee by username
      const employee = await this.employeeRepository.findByUsername(credentials.username);

      if (!employee) {
        return {
          success: false,
          message: 'Invalid username or password',
        };
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(credentials.password, employee.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid username or password',
        };
      }

      // Check if employee is active
      if (!employee.isActive) {
        return {
          success: false,
          message: 'Account is inactive',
        };
      }

      // Generate JWT token
      const token = this.generateToken(employee);

      return {
        success: true,
        token,
        employee: {
          ...employee,
          password: undefined, // Don't return password
        },
        requirePasswordChange: employee.firstLogin === true,
      };
    } catch (error) {
      return {
        success: false,
        message: `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  generateToken(employee: Employee): AuthToken {
    const payload: TokenPayload = {
      userId: employee.id,
      username: employee.username,
      email: employee.email,
      roles: Array.isArray(employee.roles) ? employee.roles : [employee.roles || 'user'],
      votingGroup: employee?.votingGroup,
    };

    const expiresIn = JWT_EXPIRES_IN || '24h';
    const options: SignOptions = {
      expiresIn: expiresIn as any,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET || 'default-secret', options);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET || 'default-secret') as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<ChangePasswordResponse> {
    try {
      // Find employee by ID
      const employee = await this.employeeRepository.findById(userId);

      if (!employee) {
        return {
          success: false,
          message: 'Employee not found',
        };
      }

      // Verify old password
      const isPasswordValid = await this.verifyPassword(oldPassword, employee.password);

      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect',
        };
      }

      // Hash new password
      const hashedPassword = await PasswordHelper.hash(newPassword);

      // Update password and clear firstLogin flag
      const updatedEmployee: Employee = {
        ...employee,
        password: hashedPassword,
        firstLogin: false,
        updatedAt: new Date(),
      };

      await this.employeeRepository.update(userId, updatedEmployee);

      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Password change failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async resetPasswordToDefault(userId: string): Promise<ChangePasswordResponse> {
    try {
      // Find employee by ID
      const employee = await this.employeeRepository.findById(userId);

      if (!employee) {
        return {
          success: false,
          message: 'Employee not found',
        };
      }

      // Hash default password
      const hashedPassword = await PasswordHelper.hash(DEFAULT_INITIAL_PASSWORD);

      // Update password and set firstLogin flag
      const updatedEmployee: Employee = {
        ...employee,
        password: hashedPassword,
        firstLogin: true,
        updatedAt: new Date(),
      };

      await this.employeeRepository.update(userId, updatedEmployee);

      return {
        success: true,
        message: `Password reset to default successfully. New password: ${DEFAULT_INITIAL_PASSWORD}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Password reset failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async bulkResetPasswordsToDefault(filters?: {
    isActive?: boolean;
    department?: string;
    position?: string;
    location?: string;
    votingGroup?: string;
  }): Promise<{
    success: boolean;
    totalReset: number;
    errors: { id: string; error: string }[];
    defaultPassword: string;
  }> {
    const result = {
      success: true,
      totalReset: 0,
      errors: [] as { id: string; error: string }[],
      defaultPassword: DEFAULT_INITIAL_PASSWORD,
    };

    try {
      // Get employees matching the filters (or all if no filters)
      const employees = await this.employeeRepository.findAll(filters || {});

      if (employees.length === 0) {
        return result;
      }

      // Hash default password once for all employees
      const hashedPassword = await PasswordHelper.hash(DEFAULT_INITIAL_PASSWORD);

      // Reset password for each employee
      for (const employee of employees) {
        try {
          const updatedEmployee: Employee = {
            ...employee,
            password: hashedPassword,
            firstLogin: true,
            updatedAt: new Date(),
          };

          await this.employeeRepository.update(employee.id, updatedEmployee);
          result.totalReset++;
        } catch (error) {
          result.errors.push({
            id: employee.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      console.log(`[AuthService] Bulk password reset: ${result.totalReset} employees updated`);
    } catch (error) {
      result.success = false;
      result.errors.push({
        id: 'BULK_RESET',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  private async verifyPassword(plainPassword: string, hashedPassword?: string): Promise<boolean> {
    if (!hashedPassword) {
      return false;
    }
    return PasswordHelper.compare(plainPassword, hashedPassword);
  }
}
