import { Body, Controller, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceEventDto } from './dto/device-event.dto';
import { DeviceEventResponseDto } from './dto/device-event-response.dto';
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
}
