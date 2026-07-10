import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { WorkspacesService } from './workspaces.service.js';
import { CreateWorkspaceDto } from './create-workspace.dto.js';
import { AddMemberDto } from './add-member.dto.js';

@ApiTags('workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @ApiOperation({ summary: 'List workspaces the current user belongs to' })
  list(@CurrentUser() userId: string) {
    return this.workspacesService.listForUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workspace (agency mode); creator becomes OWNER' })
  create(@CurrentUser() userId: string, @Body() body: CreateWorkspaceDto) {
    return this.workspacesService.create(userId, body.name);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a workspace (OWNER only)' })
  rename(@Param('id') id: string, @CurrentUser() userId: string, @Body() body: CreateWorkspaceDto) {
    return this.workspacesService.rename(id, userId, body.name);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List workspace members' })
  listMembers(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.workspacesService.listMembers(id, userId);
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add a member by email (OWNER only)' })
  addMember(@Param('id') id: string, @CurrentUser() userId: string, @Body() body: AddMemberDto) {
    return this.workspacesService.addMember(id, userId, body.email, body.role);
  }

  @Delete(':id/members/:memberId')
  @ApiOperation({ summary: 'Remove a member (OWNER only, cannot remove the OWNER)' })
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() userId: string,
  ) {
    return this.workspacesService.removeMember(id, userId, memberId);
  }
}
