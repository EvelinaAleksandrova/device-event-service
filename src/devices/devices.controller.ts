import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceEventDto } from './dto/device-event.dto';
import { DeviceEventResponseDto } from './dto/device-event-response.dto';
import {
  DeviceListResponseDto,
  nextDeviceListUrl,
} from './dto/device-list-response.dto';
import { DeviceResponseDto } from './dto/device-response.dto';
import {
  EventHistoryQueryDto,
  toEventHistoryQuery,
} from './dto/event-history-query.dto';
import {
  EventHistoryResponseDto,
  nextPageUrl,
} from './dto/event-history-response.dto';
import {
  ListDevicesQueryDto,
  toListDevicesQuery,
} from './dto/list-devices-query.dto';
import type { Response } from 'express';
import { DeviceTokenGuard } from '../auth/device-token.guard';

@UseGuards(DeviceTokenGuard)
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

  @Get(':id/events')
  async findEvents(
    @Param('id') id: string,
    @Query() queryDto: EventHistoryQueryDto,
  ): Promise<EventHistoryResponseDto> {
    const query = toEventHistoryQuery(queryDto);
    const page = await this.devicesService.findEvents(id, query);
    return new EventHistoryResponseDto(
      page.events,
      nextPageUrl(id, query.limit, page.nextCursor),
    );
  }

  @Get()
  async findAllByStatus(
    @Query() queryDto: ListDevicesQueryDto,
  ): Promise<DeviceListResponseDto> {
    const query = toListDevicesQuery(queryDto);
    const page = await this.devicesService.findAllByStatus(query);
    return new DeviceListResponseDto(
      page.devices,
      nextDeviceListUrl(query.status, query.limit, page.nextCursor),
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DeviceResponseDto> {
    const { device, status } = await this.devicesService.findOne(id);
    return new DeviceResponseDto(device, status);
  }
}
