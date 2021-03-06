
import { default as testSetup } from '../../fixtures/testSetup'

var UserTableReader = require('../../../lib/user/userTableReader').UserTableReader
  , UserDao = require('../../../lib/user/userDao').UserDao
  , path = require('path')
  , should = require('chai').should();

describe('UserTableReader tests', function() {
  var geoPackage;
  var filename;
  beforeEach('create the GeoPackage connection', async function() {
    var sampleFilename = path.join(__dirname, '..', '..', 'fixtures', 'gdal_sample.gpkg');
    // @ts-ignore
    let result = await copyAndOpenGeopackage(sampleFilename);
    filename = result.path;
    geoPackage = result.geopackage;
  });

  afterEach('close the geopackage connection', async function() {
    geoPackage.close();
    await testSetup.deleteGeoPackage(filename);
  });

  it('should read the table', function() {
    var reader = new UserTableReader('point2d');
    var table = reader.readTable(geoPackage.database);
    table.table_name.should.be.equal('point2d');
    table.columns.length.should.be.equal(8);
    table.columns[0].name.should.be.equal('fid');
    table.columns[1].name.should.be.equal('geom');
    table.columns[2].name.should.be.equal('intfield');
    table.columns[3].name.should.be.equal('strfield');
    table.columns[4].name.should.be.equal('realfield');
    table.columns[5].name.should.be.equal('datetimefield');
    table.columns[6].name.should.be.equal('datefield');
    table.columns[7].name.should.be.equal('binaryfield');
  });

  it('should query the table', function() {
    var reader = new UserTableReader('point2d');
    var table = reader.readTable(geoPackage.database);
    var ud = new UserDao(geoPackage, table);
    var results = ud.queryForAll();
    should.exist(results);
    results.length.should.be.equal(2);
    for (var i = 0; i < results.length; i++) {
      var ur = ud.getRow(results[i]);
      ur.columnCount.should.be.equal(8);
      var names = ur.columnNames
      names.should.include('fid');
      names.should.include('geom');
      names.should.include('intfield');
      names.should.include('strfield');
      names.should.include('realfield');
      names.should.include('datetimefield');
      names.should.include('datefield');
      names.should.include('binaryfield');
      ur.getColumnNameWithIndex(0).should.be.equal('fid');
      ur.getColumnIndexWithColumnName('fid').should.be.equal(0);
      ur.getValueWithIndex(0).should.be.equal(i+1);
      ur.getValueWithColumnName('fid').should.be.equal(i+1);
      ur.getRowColumnTypeWithIndex(0).should.be.equal(5);
      ur.getRowColumnTypeWithColumnName('fid').should.be.equal(5);
      ur.getColumnWithIndex(0).name.should.be.equal('fid');
      ur.getColumnWithColumnName('fid').name.should.be.equal('fid');
      ur.id.should.be.equal(i+1);
      ur.pkColumn.name.should.be.equal('fid');
      ur.getColumnWithIndex(0).getTypeName().should.be.equal('INTEGER');
      should.exist(ur.values);
    }
  });

});
