import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Logger,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AvatarService } from '../../application/services/avatar.service';
import { StorageFile } from '../../domain/models/storage-file.model';
import { UploadFileDto } from '../../dto/upload-file.dto';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { TutoringImageService } from 'src/storage/application/services/tutoringImage.service';
import { UploadTutoringImageDto } from 'src/storage/dto/upload-tutoringImage.dto';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly avatarService: AvatarService,
    private readonly tutoringImageService: TutoringImageService
  ) {
  }

  @Post('avatars')
  @ApiOperation({ summary: 'Subir un avatar para un usuario' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Avatar subido con éxito', type: StorageFile })
  @UseInterceptors(
    FileInterceptor('file', {
      // Configuración básica de Multer
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, path.join(process.cwd(), 'tmp', 'avatar-profile'));
        },
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        }
      }),
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      },
      fileFilter: (req, file, cb) => {
        // Validar tipo de archivo
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`), false);
        }
      }
    })
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto
  ): Promise<StorageFile> {
    try {
      // Log detallado para depuración
      this.logger.log(`Solicitud para subir avatar recibida:`);
      this.logger.log(`UserId: ${uploadFileDto.userId}`);
      this.logger.log(`Archivo: ${JSON.stringify({
        fieldname: file?.fieldname,
        originalname: file?.originalname,
        size: file?.size,
        mimetype: file?.mimetype,
        path: file?.path
      })}`);

      if (!file) {
        this.logger.error('Archivo no recibido por el controlador');
        throw new BadRequestException('No se recibió ningún archivo');
      }

      if (!uploadFileDto.userId) {
        this.logger.error('UserId no proporcionado');
        throw new BadRequestException('Se requiere un ID de usuario');
      }

      // Leer el archivo para pasarlo al servicio
      const fileBuffer = fs.readFileSync(file.path);

      // Subir el archivo al bucket de Supabase
      const result = await this.avatarService.uploadAvatar(
        uploadFileDto.userId,
        {
          buffer: fileBuffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        } as Express.Multer.File,
        uploadFileDto.fileName
      );

      // Eliminar el archivo temporal
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        this.logger.error(`Error eliminando archivo temporal: ${err.message}`);
      }

      this.logger.log(`Avatar subido con éxito. URL: ${result.url}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al subir avatar: ${error.message}`, error.stack);

      // Si hay un archivo temporal, intentar eliminarlo
      if (file?.path) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          this.logger.error(`Error eliminando archivo temporal: ${err.message}`);
        }
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException(`Error al procesar el avatar: ${error.message}`);
    }
  }

  @Get('avatars/:userId/:fileName')
  @ApiOperation({ summary: 'Obtener URL del avatar de un usuario' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo' })
  @ApiResponse({ status: 200, description: 'URL del avatar' })
  async getAvatarUrl(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string
  ): Promise<{ url: string }> {
    const url = await this.avatarService.getAvatarUrl(userId, fileName);
    return { url };
  }

  @Delete('avatars/:userId/:fileName')
  @ApiOperation({ summary: 'Eliminar el avatar de un usuario' })
  @ApiParam({ name: 'userId', description: 'ID del usuario' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo' })
  @ApiResponse({ status: 200, description: 'Avatar eliminado' })
  async deleteAvatar(
    @Param('userId') userId: string,
    @Param('fileName') fileName: string
  ): Promise<{ success: boolean }> {
    const result = await this.avatarService.deleteAvatar(userId, fileName);
    return { success: result };
  }


  //Tutoring Image
  @Post('tutoring-images')
  @ApiOperation({ summary: 'Subir una imagen de tutoría' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Imagen subida con éxito', type: StorageFile })
  @UseInterceptors(
    FileInterceptor('file', {
      // Configuración básica de Multer
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, path.join(process.cwd(), 'tmp', 'avatar-profile'));
        },
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
          cb(null, uniqueName);
        }
      }),
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      },
      fileFilter: (req, file, cb) => {
        // Validar tipo de archivo
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`), false);
        }
      }
    })
  )
  async uploadTutoringImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadTutoringImage: UploadTutoringImageDto
  ): Promise<StorageFile> {
    try {
      // Log detallado para depuración
      this.logger.log(`Solicitud para subir avatar recibida:`);
      this.logger.log(`UserId: ${uploadTutoringImage.tutoringId}`);
      this.logger.log(`Archivo: ${JSON.stringify({
        fieldname: file?.fieldname,
        originalname: file?.originalname,
        size: file?.size,
        mimetype: file?.mimetype,
        path: file?.path
      })}`);

      if (!file) {
        this.logger.error('Archivo no recibido por el controlador');
        throw new BadRequestException('No se recibió ningún archivo');
      }

      if (!uploadTutoringImage.tutoringId) {
        this.logger.error('UserId no proporcionado');
        throw new BadRequestException('Se requiere un ID de usuario');
      }

      // Leer el archivo para pasarlo al servicio
      const fileBuffer = fs.readFileSync(file.path);

      // Subir el archivo al bucket de Supabase
      const result = await this.tutoringImageService.uploadTutoringImage(
        uploadTutoringImage.tutoringId,
        {
          buffer: fileBuffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        } as Express.Multer.File,
        uploadTutoringImage.fileName
      );

      // Eliminar el archivo temporal
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        this.logger.error(`Error eliminando archivo temporal: ${err.message}`);
      }

      this.logger.log(`Avatar subido con éxito. URL: ${result.url}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al subir avatar: ${error.message}`, error.stack);

      // Si hay un archivo temporal, intentar eliminarlo
      if (file?.path) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          this.logger.error(`Error eliminando archivo temporal: ${err.message}`);
        }
      }

      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException(`Error al procesar el avatar: ${error.message}`);
    }
  }

  @Get('tutoring-images/:tutoringId/:fileName')
  @ApiOperation({ summary: 'Obtener URL de la image de una tutoria' })
  @ApiParam({ name: 'tutoringId', description: 'ID de la tutoría' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo' })
  @ApiResponse({ status: 200, description: 'URL del avatar' })
  async getTutoringImageUrl(
    @Param('tutoringId') tutoringId: string,
    @Param('fileName') fileName: string
  ): Promise<{ url: string }> {
    const url = await this.tutoringImageService.getTutoringImageUrl(tutoringId, fileName);
    return { url };
  }

  @Delete('tutoring-images/:tutoringId/:fileName')
  @ApiOperation({ summary: 'Eliminar la imagen de una tutoría' })
  @ApiParam({ name: 'tutoringId', description: 'ID de la tutoría' })
  @ApiParam({ name: 'fileName', description: 'Nombre del archivo' })
  @ApiResponse({ status: 200, description: 'Avatar eliminado' })
  async deleteTutoringImage(
    @Param('tutoringId') tutoringId: string,
    @Param('fileName') fileName: string
  ): Promise<{ success: boolean }> {
    const result = await this.tutoringImageService.deleteTutoringImage(tutoringId, fileName);
    return { success: result };
  }

}