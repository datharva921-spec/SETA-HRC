cmake_minimum_required(VERSION 3.10)
project(seta_hrc_cpp CXX)

set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

add_executable(setahrc src/main.cpp)

if(WIN32)
    target_link_libraries(setahrc ws2_32)
endif()
