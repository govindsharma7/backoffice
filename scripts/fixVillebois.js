// This script was used to replace ids of Rooms with uuids
const Promise = require('bluebird');
const uuid = require('uuid/v4');
const models  = require('../src/models');

[
  '313SID01',
  '313SID02',
  '313SID03',
  '313SID04',
].forEach(async (id) => {
  const newId = uuid();

  await Promise.all([
    models.Room.update({ id: newId }, { where: { id }}),
    models.Picture.update({ PicturableId: newId }, { where: { PicturableId: id }}),
    models.Term.update({ TermableId: newId }, { where: { TermableId: id }}),
    models.Metadata.update({ MetadatableId: newId }, { where: { MetadatableId: id }}),
  ]);

  await models.Renting.update({ RoomId: newId }, { where: { RoomId: id }});
});
