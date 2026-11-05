import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceEventDto } from './dto/device-event.dto';
import { DeviceEventResponseDto } from './dto/device-event-response.dto';
import { DeviceListResponseDto } from './dto/device-list-response.dto';
import { DeviceResponseDto } from './dto/device-response.dto';
import { ListDevicesQueryDto } from './dto/list-devices-query.dto';
import type { Response } from 'express';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}
  @Post(':id/events')
  async ingestEvent(
    @Param('id') id: string,
    @Body() deviceEventDto: DeviceEventDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DeviceEventResponseDto> {
    const { created, event } = await this.devicesService.ingestEvent(
      id,
      deviceEventDto,
    );
    // 201 for a new event, 200 for a duplicate; the body is the stored event either way.
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return new DeviceEventResponseDto(event);
  }

  @Get()
  async findAll(
    @Query() query: ListDevicesQueryDto,
  ): Promise<DeviceListResponseDto> {
    const devices = await this.devicesService.findAll(query.status);
    return new DeviceListResponseDto(devices);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DeviceResponseDto> {
    const { device, status } = await this.devicesService.findOne(id);
    return new DeviceResponseDto(device, status);
  }
}
