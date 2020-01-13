import { TileMatrix } from "../matrix/tileMatrix";
import { TileMatrixSet } from "../matrixset/tileMatrixSet";
import { BoundingBox } from "../../..";
import {SpatialReferenceSystem} from "../../core/srs/spatialReferenceSystem";

import fileType from 'file-type';
import { TileCreator } from './tileCreator'
import TileUtilities from './tileUtilities'
import ProjectTile from './projectTile'

export class CanvasTileCreator extends TileCreator {
  canvas: any;
  ctx: any;
  image: HTMLImageElement;
  tileCanvas: HTMLCanvasElement;
  tileContext: any;
  imageData: Uint8ClampedArray;
  constructor(width: number, height: number, tileMatrix: TileMatrix, tileMatrixSet: TileMatrixSet, tileBoundingBox: BoundingBox, srs: SpatialReferenceSystem, projectionTo: string, canvas?: any) {
    super(width, height, tileMatrix, tileMatrixSet, tileBoundingBox, srs, projectionTo);
    // eslint-disable-next-line no-undef
    this.canvas = canvas || document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');
    // eslint-disable-next-line no-undef
    this.image = document.createElement('img');
    // eslint-disable-next-line no-undef
    this.tileCanvas = document.createElement('canvas');
    this.tileContext = this.tileCanvas.getContext('2d');
    this.tileCanvas.width = tileMatrix.tile_width;
    this.tileCanvas.height = tileMatrix.tile_height;
    this.imageData = new Uint8ClampedArray(width * height * 4);
  }
  async initialize(): Promise<CanvasTileCreator> {
    return this;
  }
  addPixel(targetX: number, targetY: number, sourceX: number, sourceY: number) {
    var color = this.tileContext.getImageData(sourceX, sourceY, 1, 1);
    this.imageData.set(color.data, (targetY * this.width * 4) + (targetX * 4));
  }
  async loadImage(tileData: any) {
    var type = fileType(tileData);
    var binary = '';
    var bytes = tileData;
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // eslint-disable-next-line no-undef
    var base64Data = btoa(binary);
    return new Promise((resolve: Function) => {
      this.chunks = [];
      this.image.onload = () => {
        resolve(this.tileContext.drawImage(this.image, 0, 0));
      };
      this.image.src = 'data:' + type.mime + ';base64,' + base64Data;
    })
  }

  async addTile(tileData: any, gridColumn: number, gridRow: number) {
    var type = fileType(tileData);
    await this.loadImage(tileData);
    this.projectTile(tileData, gridColumn, gridRow);
    if (this.chunks && this.chunks.length) {
      return this.chunks.reduce(function (sequence, chunk) {
        var type = fileType(tileData);
        var binary = '';
        var bytes = chunk.chunk;
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        // eslint-disable-next-line no-undef
        var base64DataChunk = btoa(binary);
        // eslint-disable-next-line no-undef
        var image = document.createElement('img');
        return sequence.then(function () {
          return new Promise(function (resolve) {
            image.onload = function () {
              var p = chunk.position;
              this.ctx.drawImage(image, p.sx, p.sy, p.sWidth, p.sHeight, p.dx, p.dy, p.dWidth, p.dHeight);
              resolve();
            }.bind(this);
            image.src = 'data:' + type.mime + ';base64,' + base64DataChunk;
          }.bind(this));
        }.bind(this));
      }.bind(this), Promise.resolve());
    }
  }
  async getCompleteTile(format?: string): Promise<any> {
    return this.canvas.toDataURL();
  }
  async reproject(tileData: any, tilePieceBoundingBox): Promise<void> {
    var ctx = this.ctx;
    var piecePosition = TileUtilities.getPiecePosition(tilePieceBoundingBox, this.tileBoundingBox, this.height, this.width, this.projectionTo, this.projectionFrom, this.projectionFromDefinition, this.tileHeightUnitsPerPixel, this.tileWidthUnitsPerPixel, this.tileMatrix.pixel_x_size, this.tileMatrix.pixel_y_size);
    var job = {
      tileBoundingBox: JSON.stringify(this.tileBoundingBox),
      tileWidthUnitsPerPixel: this.tileWidthUnitsPerPixel,
      tileHeightUnitsPerPixel: this.tileHeightUnitsPerPixel,
      projectionTo: this.projectionTo,
      projectionFrom: this.projectionFrom,
      projectionFromDefinition: this.projectionFromDefinition,
      tileWidth: this.tileMatrix.tile_width,
      tileHeight: this.tileMatrix.tile_height,
      pixelYSize: this.tileMatrix.pixel_y_size,
      pixelXSize: this.tileMatrix.pixel_x_size,
      height: this.height,
      width: this.width,
      tilePieceBoundingBox: JSON.stringify(tilePieceBoundingBox),
      imageData: this.tileContext.getImageData(0, 0, this.tileMatrix.tile_width, this.tileMatrix.tile_height).data.buffer
    };
    return new Promise(function (resolve, reject) {
      try {
        var work = require('webworkify');
        var worker = work(require('./tileWorker.js'));
        worker.onmessage = function (e) {
          resolve(this.workerDone(e.data, piecePosition, ctx));
        };
        worker.postMessage(job, [this.tileContext.getImageData(0, 0, this.tileMatrix.tile_width, this.tileMatrix.tile_height).data.buffer]);
      }
      catch (e) {
        worker = ProjectTile;
        worker(job, function (err, data) {
          resolve(this.workerDone(data, piecePosition, ctx));
        });
      }
    }.bind(this));
  }
  workerDone(data, piecePosition, ctx) {
    if (data.message === 'done') {
      var imageData = new Uint8ClampedArray(data.imageData);
      var offsetX = piecePosition.startX;
      var offsetY = piecePosition.startY;
      var finalWidth = data.finalWidth;
      var finalHeight = data.finalHeight;
  
      // eslint-disable-next-line no-undef
      var tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = finalWidth;
      tmpCanvas.height = finalHeight;
      tmpCanvas.getContext('2d').putImageData(new ImageData(imageData, finalWidth, finalHeight), 0, 0);
  
      ctx.drawImage(tmpCanvas, offsetX, offsetY);
    }
  }
}