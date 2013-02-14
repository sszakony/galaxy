import pkg_resources

pkg_resources.require( "simplejson" )

import os, shutil, errno
import simplejson

from galaxy import util
from galaxy.util.odict import odict
from galaxy.util.template import fill_template
from galaxy.tools.data import TabularToolDataTable

#set up logger
import logging
log = logging.getLogger( __name__ )

SUPPORTED_DATA_TABLE_TYPES = ( TabularToolDataTable )

class DataManagers( object ):
    def __init__( self, app, xml_filename=None ):
        self.app = app
        self.data_managers = odict()
        self.managed_data_tables = odict()
        self.tool_path = None
        self.filename = xml_filename or self.app.config.data_manager_config_file
        self.load_from_xml( self.filename )
        if self.app.config.shed_data_manager_config_file:
            self.load_from_xml( self.app.config.shed_data_manager_config_file, store_tool_path=False )
    def load_from_xml( self, xml_filename, store_tool_path=True ):
        try:
            tree = util.parse_xml( xml_filename )
        except Exception, e:
            log.error( 'There was an error parsing your Data Manager config file "%s": %s' % ( xml_filename, e ) )
            return #we are not able to load any data managers
        root = tree.getroot()
        if root.tag != 'data_managers':
            log.error( 'A data managers configuration must have a "data_managers" tag as the root. "%s" is present' % ( root.tag ) )
            return
        if store_tool_path:
            tool_path = root.get( 'tool_path', None )
            if tool_path is None:
                tool_path = self.app.config.tool_path
            if not tool_path:
                tool_path = '.'
            self.tool_path = tool_path
        for data_manager_elem in root.findall( 'data_manager' ):
            self.load_manager_from_elem( data_manager_elem )
    def load_manager_from_elem( self, data_manager_elem, tool_path=None, add_manager=True ):
        try:
            data_manager = DataManager( self, data_manager_elem, tool_path=tool_path )
        except Exception, e:
            log.error( "Error loading data_manager '%s':\n%s" % ( e, util.xml_to_string( data_manager_elem ) ) )
            return None
        if add_manager:
            self.add_manager( data_manager )
        log.debug( 'Loaded Data Manager: %s' % ( data_manager.id ) )
        return data_manager
    def add_manager( self, data_manager ):
        assert data_manager.id not in self.data_managers, "A data manager has been defined twice: %s" % ( data_manager.id )
        self.data_managers[ data_manager.id ] = data_manager
        for data_table_name in data_manager.data_tables.keys():
            if data_table_name not in self.managed_data_tables:
                self.managed_data_tables[ data_table_name ] = []
            self.managed_data_tables[ data_table_name ].append( data_manager )
    def get_manager( self, *args, **kwds ):
        return self.data_managers.get( *args, **kwds )
    def remove_manager( self, manager_id ):
        data_manager = self.get_manager( manager_id, None )
        if data_manager is not None:
            del self.data_managers[ manager_id ]
            #remove tool from toolbox
            if data_manager.tool:
                self.app.toolbox.remove_tool_by_id( data_manager.tool.id )
            #determine if any data_tables are no longer tracked
            for data_table_name in data_manager.data_tables.keys():
                remove_data_table_tracking = True
                for other_data_manager in self.data_managers.itervalues():
                    if data_table_name in other_data_manager.data_tables:
                        remove_data_table_tracking = False
                        break
                if remove_data_table_tracking and data_table_name in self.managed_data_tables:
                    del self.managed_data_tables[ data_table_name ]

class DataManager( object ):
    def __init__( self, data_managers, elem=None, tool_path=None ):
        self.data_managers = data_managers
        self.declared_id = None
        self.name = None
        self.description = None
        self.tool = None
        self.tool_guid = None
        self.data_tables = odict()
        self.output_ref_by_data_table = {}
        self.move_by_data_table_column = {}
        self.value_translation_by_data_table_column = {}
        if elem is not None:
            self.load_from_element( elem, tool_path or self.data_managers.tool_path )
    def load_from_element( self, elem, tool_path ):
        assert elem.tag == 'data_manager', 'A data manager configuration must have a "data_manager" tag as the root. "%s" is present' % ( root.tag )
        self.declared_id = elem.get( 'id', None )
        path = elem.get( 'tool_file', None )
        if path is None:
            tool_elem = elem.find( 'tool' )
            assert tool_elem is not None, "Error loading tool for data manager. Make sure that a tool_file attribute or a tool tag set has been defined:\n%s" % ( util.xml_to_string( elem ) )
            path = tool_elem.get( "file", None )
            self.tool_guid = tool_elem.get( "guid", None )
            #use shed_conf_file to determine tool_path
            shed_conf_file = elem.get( "shed_conf_file", None )
            if shed_conf_file:
                shed_conf = self.data_managers.app.toolbox.get_shed_config_dict_by_filename( shed_conf_file, None )
                if shed_conf:
                    tool_path = shed_conf.get( "tool_path", tool_path )
        assert path is not None, "A tool file path could not be determined:\n%s" % ( util.xml_to_string( elem ) )
        self.load_tool( os.path.join( tool_path, path ), guid=self.tool_guid, data_manager_id=self.id )
        self.name = elem.get( 'name', self.tool.name )
        self.description = elem.get( 'description', self.tool.description )
        
        for data_table_elem in elem.findall( 'data_table' ):
            data_table_name = data_table_elem.get( "name" )
            assert data_table_name is not None, "A name is required for a data table entry"
            if data_table_name not in self.data_tables:
                self.data_tables[ data_table_name ] = odict()#{}
            output_elem = data_table_elem.find( 'output' )
            if output_elem is not None:
                for column_elem in output_elem.findall( 'column' ):
                    column_name = column_elem.get( 'name', None )
                    assert column_name is not None, "Name is required for column entry"
                    data_table_coumn_name = column_elem.get( 'data_table_name', column_name )
                    self.data_tables[ data_table_name ][ data_table_coumn_name ] = column_name
                    output_ref = column_elem.get( 'output_ref', None )
                    if output_ref is not None:
                        if data_table_name not in self.output_ref_by_data_table:
                            self.output_ref_by_data_table[ data_table_name ] = {}
                        self.output_ref_by_data_table[ data_table_name ][ data_table_coumn_name ] = output_ref
                    value_translation_elem = column_elem.find( 'value_translation' )
                    if value_translation_elem is not None:
                        value_translation = value_translation_elem.text
                    else:
                        value_translation = None
                    if value_translation is not None:
                        if data_table_name not in self.value_translation_by_data_table_column:
                            self.value_translation_by_data_table_column[ data_table_name ] = {}
                        self.value_translation_by_data_table_column[ data_table_name ][ data_table_coumn_name ] = value_translation

                    for move_elem in column_elem.findall( 'move' ):
                        move_type = move_elem.get( 'type', 'directory' )
                        relativize_symlinks = move_elem.get( 'relativize_symlinks', False ) #TODO: should we instead always relativize links?
                        source_elem = move_elem.find( 'source' )
                        if source_elem is None:
                            source_base = None
                            source_value = ''
                        else:
                            source_base = source_elem.get( 'base', None )
                            source_value = source_elem.text
                        target_elem = move_elem.find( 'target' )
                        if target_elem is None:
                            target_base = None
                            target_value = ''
                        else:
                            target_base = target_elem.get( 'base', None )
                            target_value = target_elem.text
                        if data_table_name not in self.move_by_data_table_column:
                            self.move_by_data_table_column[ data_table_name ] = {}
                        self.move_by_data_table_column[ data_table_name ][ data_table_coumn_name ] = dict( type=move_type, source_base=source_base, source_value=source_value, target_base=target_base, target_value=target_value, relativize_symlinks=relativize_symlinks )
    @property
    def id( self ):
        return self.tool_guid or self.declared_id #if we have a tool with a guid, we will use that as the tool_manager id
    def load_tool( self, tool_filename, guid=None, data_manager_id=None ):
        tool = self.data_managers.app.toolbox.load_tool( tool_filename, guid=guid, data_manager_id=data_manager_id )
        self.data_managers.app.toolbox.data_manager_tools[ tool.id ] = tool
        self.data_managers.app.toolbox.tools_by_id[ tool.id ] = tool
        self.tool = tool
        return tool
    
    def process_result( self, out_data ):
        data_manager_dicts = {}
        data_manager_dict = {}
        #TODO: fix this merging below
        for output_name, output_dataset in out_data.iteritems():
            try:
                output_dict = simplejson.loads( open( output_dataset.file_name ).read() )
            except Exception, e:
                log.warning( 'Error reading DataManagerTool json for "%s": %s'  % ( output_name, e ) )
                continue
            data_manager_dicts[ output_name ] = output_dict
            for key, value in output_dict.iteritems():
                if key not in data_manager_dict:
                    data_manager_dict[ key ] = {}
                data_manager_dict[ key ].update( value )
            data_manager_dict.update( output_dict )
        
        data_tables_dict = data_manager_dict.get( 'data_tables', {} )
        for data_table_name, data_table_columns in self.data_tables.iteritems():
            data_table_values = data_tables_dict.pop( data_table_name, None )
            if not data_table_values:
                log.warning( 'No values for data table "%s" were returned by the data manager "%s".' % ( data_table_name, self.id ) )
                continue #next data table
            data_table = self.data_managers.app.tool_data_tables.get( data_table_name, None )
            if data_table is None:
                log.error( 'The data manager "%s" returned an unknown data table "%s" with new entries "%s". These entries will not be created. Please confirm that an entry for "%s" exists in your "%s" file.' % ( self.id, data_table_name, data_table_values, data_table_name, 'tool_data_table_conf.xml' ) )
                continue #next table name
            if not isinstance( data_table, SUPPORTED_DATA_TABLE_TYPES ):
                log.error( 'The data manager "%s" returned an unsupported data table "%s" with type "%s" with new entries "%s". These entries will not be created. Please confirm that the data table is of a supported type (%s).' % ( self.id, data_table_name, type( data_table ), data_table_values, SUPPORTED_DATA_TABLE_TYPES ) )
                continue #next table name
            output_ref_values = {}
            if data_table_name in self.output_ref_by_data_table:
                for data_table_column, output_ref in self.output_ref_by_data_table[ data_table_name ].iteritems():
                    output_ref_dataset = out_data.get( output_ref, None )
                    assert output_ref_dataset is not None, "Referenced output was not found."
                    output_ref_values[ data_table_column ] = output_ref_dataset
            
            final_data_table_values = []
            if not isinstance( data_table_values, list ):
                data_table_values = [ data_table_values ]
            columns = data_table.get_column_name_list()
            #FIXME: Need to lock these files for editing
            try:
                data_table_fh = open( data_table.filename, 'r+b' )
            except IOError, e:
                log.warning( 'Error opening data table file (%s) with r+b, assuming file does not exist and will open as wb: %s' % ( data_table.filename, e ) )
                data_table_fh = open( data_table.filename, 'wb' )
            if os.stat( data_table.filename )[6] != 0:
                # ensure last existing line ends with new line
                data_table_fh.seek( -1, 2 ) #last char in file
                last_char = data_table_fh.read()
                if last_char not in [ '\n', '\r' ]:
                    data_table_fh.write( '\n' )
            for data_table_row in data_table_values:
                data_table_value = dict( **data_table_row ) #keep original values here
                for name, value in data_table_row.iteritems(): #FIXME: need to loop through here based upon order listed in data_manager config
                    if name in output_ref_values:
                        moved = self.process_move( data_table_name, name, output_ref_values[ name ].extra_files_path, **data_table_value )
                        data_table_value[ name ] = self.process_value_translation( data_table_name, name, **data_table_value )
                final_data_table_values.append( data_table_value )
                fields = []
                for column_name in columns:
                    if column_name is None or column_name not in data_table_value:
                        fields.append( data_table.get_empty_field_by_name( column_name ) )
                    else:
                        fields.append( data_table_value[ column_name ] )
                #should we add a comment to file about automatically generated value here?
                data_table_fh.write( "%s\n" % ( data_table.separator.join( self._replace_field_separators( fields, separator=data_table.separator ) ) ) ) #write out fields to disk
                data_table.data.append( fields ) #add fields to loaded data table
            data_table_fh.close()
        for data_table_name, data_table_values in data_tables_dict.iteritems():
            #tool returned extra data table entries, but data table was not declared in data manager
            #do not add these values, but do provide messages
            log.warning( 'The data manager "%s" returned an undeclared data table "%s" with new entries "%s". These entries will not be created. Please confirm that an entry for "%s" exists in your "%s" file.' % ( self.id, data_table_name, data_table_values, data_table_name, self.data_managers.filename ) )
    def _replace_field_separators( self, fields, separator="\t", replace=None, comment_char=None ):
        #make sure none of the fields contain separator
        #make sure separator replace is different from comment_char,
        #due to possible leading replace
        if replace is None:
            if separator == " ":
                if comment_char == "\t":
                    replace = "_"
                else:
                    replace = "\t"
            else:
                if comment_char == " ":
                    replace = "_"
                else:
                    replace = " "
        return map( lambda x: x.replace( separator, replace ), fields )
    def process_move( self, data_table_name, column_name, source_base_path, relative_symlinks=False, **kwd ):
        if data_table_name in self.move_by_data_table_column and column_name in self.move_by_data_table_column[ data_table_name ]:
            move_dict = self.move_by_data_table_column[ data_table_name ][ column_name ]
            source = move_dict[ 'source_base' ]
            if source is None:
                source = source_base_path
            else:
                source = fill_template( source, GALAXY_DATA_MANAGER_DATA_PATH=self.data_managers.app.config.galaxy_data_manager_data_path, **kwd )
            if move_dict[ 'source_value' ]:
                source = os.path.join( source, fill_template( move_dict[ 'source_value' ], GALAXY_DATA_MANAGER_DATA_PATH=self.data_managers.app.config.galaxy_data_manager_data_path, **kwd )  )
            target = move_dict[ 'target_base' ]
            if target is None:
                target = self.data_managers.app.config.galaxy_data_manager_data_path
            else:
                target = fill_template( target, GALAXY_DATA_MANAGER_DATA_PATH=self.data_managers.app.config.galaxy_data_manager_data_path, **kwd )
            if move_dict[ 'target_value' ]:
                target = os.path.join( target, fill_template( move_dict[ 'target_value' ], GALAXY_DATA_MANAGER_DATA_PATH=self.data_managers.app.config.galaxy_data_manager_data_path, **kwd  ) )
            
            if move_dict[ 'type' ] == 'file':
                dirs, filename = os.path.split( target )
                try:
                    os.makedirs( dirs )
                except OSError, e:
                    if e.errno != errno.EEXIST:
                        raise e
                    #log.debug( 'Error creating directory "%s": %s' % ( dirs, e ) )
            #moving a directory and the target already exists, we move the contents instead
            util.move_merge( source, target )
            
            if move_dict.get( 'relativize_symlinks', False ):
                util.relativize_symlinks( target )
            
            return True
        return False
    
    def process_value_translation( self, data_table_name, column_name, **kwd ):
        value = kwd.get( column_name )
        if data_table_name in self.value_translation_by_data_table_column and column_name in self.value_translation_by_data_table_column[ data_table_name ]:
            value_translation = self.value_translation_by_data_table_column[ data_table_name ][ column_name ]
            value = fill_template( value_translation, GALAXY_DATA_MANAGER_DATA_PATH=self.data_managers.app.config.galaxy_data_manager_data_path, **kwd  )
        return value
