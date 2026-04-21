import { Injectable, NotFoundException } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { PrismaService } from '@socialdrop/prisma';

export class CreateFlowDto {
  @IsString()
  name!: string;

  @IsString()
  platform!: string;

  @IsString()
  trigger!: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsArray()
  nodes?: any[];

  @IsOptional()
  @IsArray()
  edges?: any[];
}

export class UpdateFlowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  platform?: string;

  @IsOptional()
  @IsString()
  trigger?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsArray()
  nodes?: any[];

  @IsOptional()
  @IsArray()
  edges?: any[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class FlowsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.flow.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { executions: true } } },
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.flow.findFirst({ where: { id, userId } });
  }

  create(userId: string, dto: CreateFlowDto) {
    return this.prisma.flow.create({
      data: {
        userId,
        name: dto.name,
        platform: dto.platform,
        trigger: dto.trigger,
        keyword: dto.keyword,
        nodes: dto.nodes ?? [],
        edges: dto.edges ?? [],
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateFlowDto) {
    await this.ensureExists(id, userId);
    return this.prisma.flow.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, userId: string) {
    await this.ensureExists(id, userId);
    return this.prisma.flow.delete({ where: { id } });
  }

  async toggle(id: string, userId: string) {
    const flow = await this.ensureExists(id, userId);
    return this.prisma.flow.update({
      where: { id },
      data: { isActive: !flow.isActive },
    });
  }

  private async ensureExists(id: string, userId: string) {
    const flow = await this.prisma.flow.findFirst({ where: { id, userId } });
    if (!flow) throw new NotFoundException(`Flow ${id} not found`);
    return flow;
  }
}
